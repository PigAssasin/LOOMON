// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { LoomonQuoteDecision } from "../src/LoomonQuoteDecision.sol";

interface QuoteDecisionDeployVm {
    function envAddress(string calldata key) external view returns (address);
    function envUint(string calldata key) external view returns (uint256);
    function startBroadcast(uint256 privateKey) external;
    function stopBroadcast() external;
}

contract DeployQuoteDecision {
    QuoteDecisionDeployVm private constant vm =
        QuoteDecisionDeployVm(address(uint160(uint256(keccak256("hevm cheat code")))));

    function run() external returns (LoomonQuoteDecision registry) {
        uint256 deployerKey = vm.envUint("ARC_DEPLOYER_PRIVATE_KEY");
        address seller = vm.envAddress("LOOMON_SINGLE_SELLER_ADDRESS");
        vm.startBroadcast(deployerKey);
        registry = new LoomonQuoteDecision(seller);
        vm.stopBroadcast();
    }
}
