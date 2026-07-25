// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { LoomonEscrowPool } from "../src/LoomonEscrowPool.sol";

interface PoolVm {
    function prank(address msgSender) external;
    function warp(uint256 newTimestamp) external;
}

contract PoolMockUSDC {
    mapping(address account => uint256 balance) public balanceOf;
    mapping(address owner => mapping(address spender => uint256 amount)) public allowance;

    function mint(address account, uint256 amount) external {
        balanceOf[account] += amount;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        if (balanceOf[msg.sender] < amount) return false;
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        if (balanceOf[from] < amount || allowance[from][msg.sender] < amount) return false;
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}

contract LoomonEscrowPoolTest {
    PoolVm private constant vm = PoolVm(address(uint160(uint256(keccak256("hevm cheat code")))));

    PoolMockUSDC private usdc;
    LoomonEscrowPool private pool;

    address private buyer = address(0xB0B);
    address private seller = address(0xA11CE);
    address private resolver = address(0xC0DE);
    bytes32 private orderId = keccak256("LM-26-07-ABC123");
    bytes32 private termsHash = keccak256("terms-v1");
    uint256 private amount = 240_000_000;

    function setUp() public {
        usdc = new PoolMockUSDC();
        pool = new LoomonEscrowPool(address(usdc), resolver);
        usdc.mint(buyer, 1_000_000_000);
        vm.prank(buyer);
        usdc.approve(address(pool), amount);
    }

    function testBuyerPlacesFundedOrderWithoutSellerAcceptance() public {
        vm.prank(buyer);
        pool.placeOrder(orderId, seller, amount, termsHash);

        LoomonEscrowPool.Order memory order = pool.getOrder(orderId);
        assertEq(uint256(order.state), uint256(LoomonEscrowPool.State.Funded), "funded");
        assertEq(order.buyer, buyer, "buyer");
        assertEq(order.seller, seller, "seller");
        assertEq(usdc.balanceOf(address(pool)), amount, "pool balance");
    }

    function testSellerCanClaimOnlySevenDaysAfterBuyerCompletion() public {
        _placeAndDeliver();

        vm.prank(buyer);
        pool.confirmCompletion(orderId, keccak256("buyer-confirmed"));

        vm.prank(seller);
        (bool early,) =
            address(pool).call(abi.encodeCall(LoomonEscrowPool.claimSellerFunds, (orderId)));
        assertTrue(!early, "early claim must fail");

        LoomonEscrowPool.Order memory order = pool.getOrder(orderId);
        vm.warp(uint256(order.sellerClaimableAt));
        vm.prank(seller);
        pool.claimSellerFunds(orderId);

        assertEq(usdc.balanceOf(seller), amount, "seller paid");
        assertEq(
            uint256(pool.getOrder(orderId).state),
            uint256(LoomonEscrowPool.State.Released),
            "released"
        );
    }

    function testBuyerCanCancelBeforeProduction() public {
        _place();
        vm.prank(buyer);
        pool.cancelBeforeProduction(orderId, keccak256("changed mind"));

        assertEq(usdc.balanceOf(buyer), 1_000_000_000, "buyer refunded");
        assertEq(
            uint256(pool.getOrder(orderId).state),
            uint256(LoomonEscrowPool.State.Refunded),
            "refunded"
        );
    }

    function testSellerCanRefundAfterProductionStarts() public {
        _place();
        vm.prank(seller);
        pool.startProduction(orderId);
        vm.prank(seller);
        pool.refundBuyer(orderId, keccak256("cannot fulfil"));

        assertEq(usdc.balanceOf(buyer), 1_000_000_000, "buyer refunded");
    }

    function testDisputeFreezesSellerClaimAndResolverCanSplit() public {
        _placeAndDeliver();
        vm.prank(buyer);
        pool.confirmCompletion(orderId, keccak256("buyer-confirmed"));
        vm.prank(buyer);
        pool.raiseDispute(orderId, keccak256("quality issue"));

        vm.warp(block.timestamp + 8 days);
        vm.prank(seller);
        (bool claimOk,) =
            address(pool).call(abi.encodeCall(LoomonEscrowPool.claimSellerFunds, (orderId)));
        assertTrue(!claimOk, "dispute freezes claim");

        vm.prank(resolver);
        pool.resolveDispute(orderId, 60_000_000, 180_000_000, keccak256("partial refund"));
        vm.prank(buyer);
        pool.withdrawResolvedFunds(orderId);
        vm.prank(seller);
        pool.withdrawResolvedFunds(orderId);

        assertEq(usdc.balanceOf(buyer), 820_000_000, "buyer split");
        assertEq(usdc.balanceOf(seller), 180_000_000, "seller split");
    }

    function testOrderIdCannotBeReused() public {
        _place();
        vm.prank(buyer);
        (bool ok,) = address(pool)
            .call(
                abi.encodeCall(
                    LoomonEscrowPool.placeOrder, (orderId, seller, amount, keccak256("different"))
                )
            );
        assertTrue(!ok, "duplicate order must fail");
    }

    function _place() private {
        vm.prank(buyer);
        pool.placeOrder(orderId, seller, amount, termsHash);
    }

    function _placeAndDeliver() private {
        _place();
        vm.prank(seller);
        pool.startProduction(orderId);
        vm.prank(seller);
        pool.markDelivered(orderId, keccak256("delivery"));
    }

    function assertEq(address actual, address expected, string memory reason) private pure {
        require(actual == expected, reason);
    }

    function assertEq(uint256 actual, uint256 expected, string memory reason) private pure {
        require(actual == expected, reason);
    }

    function assertTrue(bool condition, string memory reason) private pure {
        require(condition, reason);
    }
}
