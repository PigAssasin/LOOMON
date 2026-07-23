// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { LoomonEscrowFactory, LoomonOrderEscrow } from "../src/LoomonEscrow.sol";

interface Vm {
    function prank(address msgSender) external;
    function warp(uint256 newTimestamp) external;
}

contract MockUSDC {
    string public constant name = "Mock USDC";
    string public constant symbol = "USDC";
    uint8 public constant decimals = 6;

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
        if (balanceOf[from] < amount) return false;
        if (allowance[from][msg.sender] < amount) return false;
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}

contract LoomonEscrowTest {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    MockUSDC private usdc;
    LoomonEscrowFactory private factory;

    address private buyer = address(0xB0B);
    address private merchant = address(0xA11CE);
    address private resolver = address(0xC0DE);
    address private agentWallet = address(0xA9E17);
    bytes32 private orderId = keccak256("LOOMON-T-20260723-000001");
    bytes32 private termsHash = keccak256("terms-v1");
    uint256 private amount = 240_000_000;

    function setUp() public {
        usdc = new MockUSDC();
        factory = new LoomonEscrowFactory(address(usdc), resolver);
        usdc.mint(buyer, 1_000_000_000);
        usdc.mint(agentWallet, 1_000_000_000);
    }

    function testFactoryCreatesEscrowOncePerOrderId() public {
        address escrow = factory.createEscrow(buyer, merchant, orderId, amount, termsHash);

        assertTrue(escrow != address(0), "escrow not deployed");
        assertEq(factory.escrowsByOrderId(orderId), escrow, "order mapping");

        (bool ok,) = address(factory)
            .call(
                abi.encodeCall(
                    LoomonEscrowFactory.createEscrow, (buyer, merchant, orderId, amount, termsHash)
                )
            );
        assertTrue(!ok, "duplicate order should revert");
    }

    function testMerchantAcceptsThenBuyerFundsAndReleases() public {
        LoomonOrderEscrow escrow = _createAcceptedEscrow();

        vm.prank(buyer);
        usdc.approve(address(escrow), amount);
        vm.prank(buyer);
        escrow.fund();

        assertEq(uint256(escrow.state()), uint256(LoomonOrderEscrow.State.Funded), "funded state");

        vm.prank(buyer);
        escrow.release(keccak256("buyer-approved-delivery"));
        assertEq(escrow.withdrawable(merchant), amount, "merchant claim");

        vm.prank(merchant);
        escrow.withdraw();
        assertEq(usdc.balanceOf(merchant), amount, "merchant paid");
    }

    function testAgentWalletCanFundAndCancelWithinPolicy() public {
        LoomonOrderEscrow escrow = _createAcceptedEscrow();

        vm.prank(buyer);
        escrow.setBuyerOperator(
            agentWallet, uint64(block.timestamp + 1 days), amount, keccak256("policy")
        );

        vm.prank(agentWallet);
        usdc.approve(address(escrow), amount);
        vm.prank(agentWallet);
        escrow.fund();

        vm.prank(agentWallet);
        escrow.cancel(keccak256("user asked to cancel"));

        assertEq(escrow.withdrawable(buyer), amount, "buyer refund claim");
    }

    function testAgentWalletCannotActWhenExpired() public {
        LoomonOrderEscrow escrow = _createAcceptedEscrow();

        vm.prank(buyer);
        escrow.setBuyerOperator(
            agentWallet, uint64(block.timestamp + 10), amount, keccak256("policy")
        );
        vm.warp(block.timestamp + 11);

        vm.prank(agentWallet);
        (bool ok,) =
            address(escrow).call(abi.encodeCall(LoomonOrderEscrow.cancel, (keccak256("late"))));

        assertTrue(!ok, "expired operator should revert");
    }

    function testAgentWalletCannotExceedAllowance() public {
        LoomonOrderEscrow escrow = _createAcceptedEscrow();

        vm.prank(buyer);
        escrow.setBuyerOperator(
            agentWallet, uint64(block.timestamp + 1 days), amount - 1, keccak256("policy")
        );

        vm.prank(agentWallet);
        usdc.approve(address(escrow), amount);
        vm.prank(agentWallet);
        (bool ok,) = address(escrow).call(abi.encodeCall(LoomonOrderEscrow.fund, ()));

        assertTrue(!ok, "operator over allowance should revert");
    }

    function testResolverCanSplitDispute() public {
        LoomonOrderEscrow escrow = _createAcceptedEscrow();

        vm.prank(buyer);
        usdc.approve(address(escrow), amount);
        vm.prank(buyer);
        escrow.fund();
        vm.prank(merchant);
        escrow.raiseDispute(keccak256("shipping issue"));

        vm.prank(resolver);
        escrow.resolveDispute(60_000_000, 180_000_000, keccak256("partial refund"));

        assertEq(escrow.withdrawable(buyer), 60_000_000, "buyer claim");
        assertEq(escrow.withdrawable(merchant), 180_000_000, "merchant claim");
    }

    function _createAcceptedEscrow() private returns (LoomonOrderEscrow escrow) {
        escrow =
            LoomonOrderEscrow(factory.createEscrow(buyer, merchant, orderId, amount, termsHash));
        vm.prank(merchant);
        escrow.accept(keccak256("maker quote"));
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
