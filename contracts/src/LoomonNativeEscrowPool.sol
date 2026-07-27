// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @notice Shared prepaid physical-order escrow for LOOMON on Arc using native USDC.
/// @dev Arc native USDC uses 18-decimal msg.value semantics. LOOMON application
/// amounts remain 6-decimal USDC atomic units, so native transfers multiply by 1e12.
contract LoomonNativeEscrowPool {
    uint64 public constant SELLER_RELEASE_DELAY = 7 days;
    uint256 private constant NATIVE_SCALE = 1e12;

    enum State {
        None,
        Funded,
        InProduction,
        Delivered,
        CompletionHold,
        Released,
        Refunded,
        Disputed,
        Resolved
    }

    struct Order {
        address buyer;
        address seller;
        uint256 amountAtomic;
        bytes32 termsHash;
        State state;
        uint64 fundedAt;
        uint64 completedAt;
        uint64 sellerClaimableAt;
    }

    address public immutable resolver;

    mapping(bytes32 orderId => Order order) private orders;
    mapping(bytes32 orderId => mapping(address account => uint256 amountAtomic)) public
        resolvedWithdrawable;

    uint256 private unlocked = 1;

    event OrderFunded(
        bytes32 indexed orderId,
        address indexed buyer,
        address indexed seller,
        uint256 amountAtomic,
        bytes32 termsHash
    );
    event ProductionStarted(bytes32 indexed orderId, address indexed seller);
    event OrderDelivered(bytes32 indexed orderId, address indexed seller, bytes32 evidenceHash);
    event CompletionConfirmed(
        bytes32 indexed orderId,
        address indexed buyer,
        bytes32 evidenceHash,
        uint64 sellerClaimableAt
    );
    event SellerFundsClaimed(bytes32 indexed orderId, address indexed seller, uint256 amountAtomic);
    event BuyerRefunded(
        bytes32 indexed orderId,
        address indexed actor,
        address indexed buyer,
        uint256 amountAtomic,
        bytes32 reasonHash
    );
    event DisputeRaised(bytes32 indexed orderId, address indexed actor, bytes32 reasonHash);
    event DisputeResolved(
        bytes32 indexed orderId,
        address indexed resolver,
        uint256 buyerAmountAtomic,
        uint256 sellerAmountAtomic,
        bytes32 decisionHash
    );
    event ResolvedFundsWithdrawn(
        bytes32 indexed orderId, address indexed account, uint256 amountAtomic
    );

    error ZeroAddress();
    error ZeroAmount();
    error EmptyHash();
    error DuplicateOrder();
    error OrderNotFound();
    error Unauthorized();
    error InvalidState(State current);
    error SellerFundsLocked(uint64 claimableAt);
    error InvalidSplit();
    error IncorrectNativeAmount(uint256 expected, uint256 received);
    error NothingToWithdraw();
    error TransferFailed();
    error ReentrantCall();

    constructor(address resolver_) {
        if (resolver_ == address(0)) revert ZeroAddress();
        resolver = resolver_;
    }

    modifier nonReentrant() {
        if (unlocked != 1) revert ReentrantCall();
        unlocked = 2;
        _;
        unlocked = 1;
    }

    function getOrder(bytes32 orderId) external view returns (Order memory) {
        Order memory order = orders[orderId];
        if (order.state == State.None) revert OrderNotFound();
        return order;
    }

    function placeOrder(bytes32 orderId, address seller, uint256 amountAtomic, bytes32 termsHash)
        external
        payable
        nonReentrant
    {
        if (orderId == bytes32(0) || termsHash == bytes32(0)) revert EmptyHash();
        if (seller == address(0)) revert ZeroAddress();
        if (amountAtomic == 0) revert ZeroAmount();
        if (orders[orderId].state != State.None) revert DuplicateOrder();

        uint256 expectedNativeAmount = amountAtomic * NATIVE_SCALE;
        if (msg.value != expectedNativeAmount) {
            revert IncorrectNativeAmount(expectedNativeAmount, msg.value);
        }

        orders[orderId] = Order({
            buyer: msg.sender,
            seller: seller,
            amountAtomic: amountAtomic,
            termsHash: termsHash,
            state: State.Funded,
            fundedAt: uint64(block.timestamp),
            completedAt: 0,
            sellerClaimableAt: 0
        });

        emit OrderFunded(orderId, msg.sender, seller, amountAtomic, termsHash);
    }

    function startProduction(bytes32 orderId) external {
        Order storage order = _order(orderId);
        _requireSeller(order);
        _requireState(order, State.Funded);
        order.state = State.InProduction;
        emit ProductionStarted(orderId, msg.sender);
    }

    function markDelivered(bytes32 orderId, bytes32 evidenceHash) external {
        if (evidenceHash == bytes32(0)) revert EmptyHash();
        Order storage order = _order(orderId);
        _requireSeller(order);
        _requireState(order, State.InProduction);
        order.state = State.Delivered;
        emit OrderDelivered(orderId, msg.sender, evidenceHash);
    }

    function confirmCompletion(bytes32 orderId, bytes32 evidenceHash) external {
        if (evidenceHash == bytes32(0)) revert EmptyHash();
        Order storage order = _order(orderId);
        _requireBuyer(order);
        _requireState(order, State.Delivered);

        uint64 completedAt = uint64(block.timestamp);
        uint64 claimableAt = completedAt + SELLER_RELEASE_DELAY;
        order.state = State.CompletionHold;
        order.completedAt = completedAt;
        order.sellerClaimableAt = claimableAt;

        emit CompletionConfirmed(orderId, msg.sender, evidenceHash, claimableAt);
    }

    function claimSellerFunds(bytes32 orderId) external nonReentrant {
        Order storage order = _order(orderId);
        _requireSeller(order);
        _requireState(order, State.CompletionHold);
        if (block.timestamp < order.sellerClaimableAt) {
            revert SellerFundsLocked(order.sellerClaimableAt);
        }

        order.state = State.Released;
        uint256 amount = order.amountAtomic;
        _safeTransferNative(order.seller, amount);
        emit SellerFundsClaimed(orderId, order.seller, amount);
    }

    function cancelBeforeProduction(bytes32 orderId, bytes32 reasonHash) external nonReentrant {
        if (reasonHash == bytes32(0)) revert EmptyHash();
        Order storage order = _order(orderId);
        _requireBuyer(order);
        _requireState(order, State.Funded);
        _refund(orderId, order, msg.sender, reasonHash);
    }

    function refundBuyer(bytes32 orderId, bytes32 reasonHash) external nonReentrant {
        if (reasonHash == bytes32(0)) revert EmptyHash();
        Order storage order = _order(orderId);
        _requireSeller(order);
        if (
            order.state != State.Funded && order.state != State.InProduction
                && order.state != State.Delivered
        ) {
            revert InvalidState(order.state);
        }
        _refund(orderId, order, msg.sender, reasonHash);
    }

    function raiseDispute(bytes32 orderId, bytes32 reasonHash) external {
        if (reasonHash == bytes32(0)) revert EmptyHash();
        Order storage order = _order(orderId);
        if (msg.sender != order.buyer && msg.sender != order.seller) revert Unauthorized();
        if (
            order.state != State.Funded && order.state != State.InProduction
                && order.state != State.Delivered && order.state != State.CompletionHold
        ) {
            revert InvalidState(order.state);
        }
        order.state = State.Disputed;
        emit DisputeRaised(orderId, msg.sender, reasonHash);
    }

    function resolveDispute(
        bytes32 orderId,
        uint256 buyerAmountAtomic,
        uint256 sellerAmountAtomic,
        bytes32 decisionHash
    ) external {
        if (msg.sender != resolver) revert Unauthorized();
        if (decisionHash == bytes32(0)) revert EmptyHash();
        Order storage order = _order(orderId);
        _requireState(order, State.Disputed);
        if (buyerAmountAtomic + sellerAmountAtomic != order.amountAtomic) {
            revert InvalidSplit();
        }

        order.state = State.Resolved;
        resolvedWithdrawable[orderId][order.buyer] = buyerAmountAtomic;
        resolvedWithdrawable[orderId][order.seller] = sellerAmountAtomic;

        emit DisputeResolved(
            orderId, msg.sender, buyerAmountAtomic, sellerAmountAtomic, decisionHash
        );
    }

    function withdrawResolvedFunds(bytes32 orderId) external nonReentrant {
        Order storage order = _order(orderId);
        _requireState(order, State.Resolved);
        uint256 amount = resolvedWithdrawable[orderId][msg.sender];
        if (amount == 0) revert NothingToWithdraw();
        resolvedWithdrawable[orderId][msg.sender] = 0;
        _safeTransferNative(msg.sender, amount);
        emit ResolvedFundsWithdrawn(orderId, msg.sender, amount);
    }

    function _refund(bytes32 orderId, Order storage order, address actor, bytes32 reasonHash)
        private
    {
        order.state = State.Refunded;
        uint256 amount = order.amountAtomic;
        _safeTransferNative(order.buyer, amount);
        emit BuyerRefunded(orderId, actor, order.buyer, amount, reasonHash);
    }

    function _order(bytes32 orderId) private view returns (Order storage order) {
        order = orders[orderId];
        if (order.state == State.None) revert OrderNotFound();
    }

    function _requireBuyer(Order storage order) private view {
        if (msg.sender != order.buyer) revert Unauthorized();
    }

    function _requireSeller(Order storage order) private view {
        if (msg.sender != order.seller) revert Unauthorized();
    }

    function _requireState(Order storage order, State expected) private view {
        if (order.state != expected) revert InvalidState(order.state);
    }

    function _safeTransferNative(address to, uint256 amountAtomic) private {
        (bool ok,) = to.call{ value: amountAtomic * NATIVE_SCALE }("");
        if (!ok) revert TransferFailed();
    }
}
