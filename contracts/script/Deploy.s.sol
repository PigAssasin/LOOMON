// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { LoomonEscrowFactory } from "../src/LoomonEscrow.sol";

interface Vm {
    function envAddress(string calldata name) external returns (address);
    function startBroadcast() external;
    function stopBroadcast() external;
}

contract Deploy {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    function run() external returns (LoomonEscrowFactory factory) {
        address paymentToken = vm.envAddress("LOOMON_PAYMENT_TOKEN");
        address resolver = vm.envAddress("LOOMON_RESOLVER");

        vm.startBroadcast();
        factory = new LoomonEscrowFactory(paymentToken, resolver);
        vm.stopBroadcast();
    }
}
