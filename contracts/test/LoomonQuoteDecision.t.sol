// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { LoomonQuoteDecision } from "../src/LoomonQuoteDecision.sol";

interface QuoteDecisionVm {
    function expectRevert(bytes4 selector) external;
    function prank(address account) external;
}

contract LoomonQuoteDecisionTest {
    QuoteDecisionVm private constant vm =
        QuoteDecisionVm(address(uint160(uint256(keccak256("hevm cheat code")))));

    address private seller = address(0x51);
    address private buyer = address(0xB0B);
    LoomonQuoteDecision private registry;

    function setUp() public {
        registry = new LoomonQuoteDecision(seller);
    }

    function testSellerCanAcceptOrReject() public {
        vm.prank(seller);
        registry.decide(keccak256("request-1"), 1, keccak256("accept"));

        vm.prank(seller);
        registry.decide(keccak256("request-2"), 2, keccak256("reject"));
    }

    function testOnlySellerCanDecide() public {
        vm.prank(buyer);
        vm.expectRevert(LoomonQuoteDecision.Unauthorized.selector);
        registry.decide(keccak256("request-1"), 1, keccak256("accept"));
    }

    function testRejectsInvalidDecision() public {
        vm.prank(seller);
        vm.expectRevert(LoomonQuoteDecision.InvalidDecision.selector);
        registry.decide(keccak256("request-1"), 3, keccak256("invalid"));
    }
}
