// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

interface IERC20Minimal {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

/// @notice One physical-goods order escrow for LOOMON on Arc.
/// @dev The AI agent is modeled as a bounded buyer operator, never as an omnipotent signer.
contract LoomonOrderEscrow {
    enum State {
        Created,
        Accepted,
        Funded,
        Cancelled,
        Released,
        Disputed,
        Resolved
    }

    IERC20Minimal public immutable paymentToken;
    address public immutable buyer;
    address public immutable merchant;
    address public immutable resolver;
    bytes32 public immutable orderId;
    bytes32 public immutable termsHash;
    uint256 public immutable amountAtomic;

    State public state;
    uint64 public acceptedAt;

    address public buyerOperator;
    uint64 public buyerOperatorExpiresAt;
    uint256 public buyerOperatorAllowanceAtomic;
    bytes32 public buyerOperatorPolicyHash;

    mapping(address account => uint256 amountAtomic) public withdrawable;

    event EscrowCreated(
        bytes32 indexed orderId,
        address indexed buyer,
        address indexed merchant,
        address paymentToken,
        uint256 amountAtomic,
        bytes32 termsHash
    );
    event MerchantAccepted(bytes32 indexed orderId, address indexed merchant, bytes32 quoteHash);
    event BuyerOperatorSet(
        bytes32 indexed orderId,
        address indexed operator,
        uint64 expiresAt,
        uint256 allowanceAtomic,
        bytes32 policyHash
    );
    event BuyerOperatorRevoked(bytes32 indexed orderId, address indexed operator);
    event Funded(bytes32 indexed orderId, address indexed payer, uint256 amountAtomic);
    event Cancelled(bytes32 indexed orderId, address indexed actor, bytes32 reasonHash);
    event Released(bytes32 indexed orderId, address indexed actor, bytes32 evidenceHash);
    event DisputeRaised(bytes32 indexed orderId, address indexed actor, bytes32 reasonHash);
    event DisputeResolved(
        bytes32 indexed orderId,
        address indexed resolver,
        uint256 buyerAmountAtomic,
        uint256 merchantAmountAtomic,
        bytes32 decisionHash
    );
    event Withdrawn(bytes32 indexed orderId, address indexed account, uint256 amountAtomic);

    error ZeroAddress();
    error ZeroAmount();
    error InvalidState(State current);
    error Unauthorized();
    error OperatorExpired();
    error OperatorAllowanceTooLow();
    error TransferFailed();
    error InvalidSplit();
    error NothingToWithdraw();

    constructor(
        address paymentToken_,
        address buyer_,
        address merchant_,
        address resolver_,
        bytes32 orderId_,
        uint256 amountAtomic_,
        bytes32 termsHash_
    ) {
        if (
            paymentToken_ == address(0) || buyer_ == address(0) || merchant_ == address(0)
                || resolver_ == address(0)
        ) {
            revert ZeroAddress();
        }
        if (amountAtomic_ == 0) revert ZeroAmount();
        if (orderId_ == bytes32(0) || termsHash_ == bytes32(0)) revert ZeroAmount();

        paymentToken = IERC20Minimal(paymentToken_);
        buyer = buyer_;
        merchant = merchant_;
        resolver = resolver_;
        orderId = orderId_;
        amountAtomic = amountAtomic_;
        termsHash = termsHash_;
        state = State.Created;

        emit EscrowCreated(orderId_, buyer_, merchant_, paymentToken_, amountAtomic_, termsHash_);
    }

    function accept(bytes32 quoteHash) external {
        if (msg.sender != merchant) revert Unauthorized();
        if (state != State.Created) revert InvalidState(state);

        acceptedAt = uint64(block.timestamp);
        state = State.Accepted;

        emit MerchantAccepted(orderId, msg.sender, quoteHash);
    }

    function setBuyerOperator(
        address operator,
        uint64 expiresAt,
        uint256 allowanceAtomic,
        bytes32 policyHash
    ) external {
        if (msg.sender != buyer) revert Unauthorized();
        if (operator == address(0)) revert ZeroAddress();
        if (expiresAt <= block.timestamp) revert OperatorExpired();
        if (allowanceAtomic == 0) revert ZeroAmount();
        if (policyHash == bytes32(0)) revert ZeroAmount();

        buyerOperator = operator;
        buyerOperatorExpiresAt = expiresAt;
        buyerOperatorAllowanceAtomic = allowanceAtomic;
        buyerOperatorPolicyHash = policyHash;

        emit BuyerOperatorSet(orderId, operator, expiresAt, allowanceAtomic, policyHash);
    }

    function revokeBuyerOperator() external {
        if (msg.sender != buyer) revert Unauthorized();

        address oldOperator = buyerOperator;
        buyerOperator = address(0);
        buyerOperatorExpiresAt = 0;
        buyerOperatorAllowanceAtomic = 0;
        buyerOperatorPolicyHash = bytes32(0);

        emit BuyerOperatorRevoked(orderId, oldOperator);
    }

    function fund() external {
        if (state != State.Accepted) revert InvalidState(state);
        _requireBuyerOrOperator(amountAtomic);

        state = State.Funded;
        _safeTransferFrom(paymentToken, msg.sender, address(this), amountAtomic);

        emit Funded(orderId, msg.sender, amountAtomic);
    }

    function cancel(bytes32 reasonHash) external {
        if (state == State.Created || state == State.Accepted) {
            _requireBuyerOrOperator(0);
            state = State.Cancelled;
            emit Cancelled(orderId, msg.sender, reasonHash);
            return;
        }

        if (state != State.Funded) revert InvalidState(state);
        _requireBuyerOrOperator(amountAtomic);

        state = State.Cancelled;
        withdrawable[buyer] += amountAtomic;

        emit Cancelled(orderId, msg.sender, reasonHash);
    }

    function release(bytes32 evidenceHash) external {
        if (state != State.Funded) revert InvalidState(state);
        _requireBuyerOrOperator(amountAtomic);

        state = State.Released;
        withdrawable[merchant] += amountAtomic;

        emit Released(orderId, msg.sender, evidenceHash);
    }

    function raiseDispute(bytes32 reasonHash) external {
        if (state != State.Funded) revert InvalidState(state);
        if (msg.sender != buyer && msg.sender != merchant && msg.sender != buyerOperator) {
            revert Unauthorized();
        }
        if (msg.sender == buyerOperator) _requireActiveOperator(amountAtomic);

        state = State.Disputed;

        emit DisputeRaised(orderId, msg.sender, reasonHash);
    }

    function resolveDispute(
        uint256 buyerAmountAtomic,
        uint256 merchantAmountAtomic,
        bytes32 decisionHash
    ) external {
        if (msg.sender != resolver) revert Unauthorized();
        if (state != State.Disputed) revert InvalidState(state);
        if (buyerAmountAtomic + merchantAmountAtomic != amountAtomic) revert InvalidSplit();

        state = State.Resolved;
        if (buyerAmountAtomic != 0) withdrawable[buyer] += buyerAmountAtomic;
        if (merchantAmountAtomic != 0) withdrawable[merchant] += merchantAmountAtomic;

        emit DisputeResolved(
            orderId, msg.sender, buyerAmountAtomic, merchantAmountAtomic, decisionHash
        );
    }

    function withdraw() external {
        uint256 amount = withdrawable[msg.sender];
        if (amount == 0) revert NothingToWithdraw();

        withdrawable[msg.sender] = 0;
        _safeTransfer(paymentToken, msg.sender, amount);

        emit Withdrawn(orderId, msg.sender, amount);
    }

    function _requireBuyerOrOperator(uint256 requiredAllowanceAtomic) internal view {
        if (msg.sender == buyer) return;
        if (msg.sender == buyerOperator) {
            _requireActiveOperator(requiredAllowanceAtomic);
            return;
        }
        revert Unauthorized();
    }

    function _requireActiveOperator(uint256 requiredAllowanceAtomic) internal view {
        if (block.timestamp > buyerOperatorExpiresAt) revert OperatorExpired();
        if (buyerOperatorAllowanceAtomic < requiredAllowanceAtomic) {
            revert OperatorAllowanceTooLow();
        }
    }

    function _safeTransferFrom(IERC20Minimal token, address from, address to, uint256 amount)
        internal
    {
        bool ok = token.transferFrom(from, to, amount);
        if (!ok) revert TransferFailed();
    }

    function _safeTransfer(IERC20Minimal token, address to, uint256 amount) internal {
        bool ok = token.transfer(to, amount);
        if (!ok) revert TransferFailed();
    }
}

contract LoomonEscrowFactory {
    address public immutable paymentToken;
    address public immutable resolver;

    mapping(bytes32 orderId => address escrow) public escrowsByOrderId;

    event EscrowDeployed(
        bytes32 indexed orderId, address indexed escrow, address indexed buyer, address merchant
    );

    error ZeroAddress();
    error DuplicateOrder();

    constructor(address paymentToken_, address resolver_) {
        if (paymentToken_ == address(0) || resolver_ == address(0)) revert ZeroAddress();
        paymentToken = paymentToken_;
        resolver = resolver_;
    }

    function createEscrow(
        address buyer,
        address merchant,
        bytes32 orderId,
        uint256 amountAtomic,
        bytes32 termsHash
    ) external returns (address escrow) {
        if (escrowsByOrderId[orderId] != address(0)) revert DuplicateOrder();

        escrow = address(
            new LoomonOrderEscrow(
                paymentToken, buyer, merchant, resolver, orderId, amountAtomic, termsHash
            )
        );
        escrowsByOrderId[orderId] = escrow;

        emit EscrowDeployed(orderId, escrow, buyer, merchant);
    }
}
