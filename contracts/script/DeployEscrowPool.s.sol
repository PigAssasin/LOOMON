// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { LoomonNativeEscrowPool } from "../src/LoomonNativeEscrowPool.sol";

interface EscrowDeployVm {
    function envUint(string calldata name) external returns (uint256);
    function addr(uint256 privateKey) external returns (address);
    function startBroadcast(uint256 privateKey) external;
    function stopBroadcast() external;
}

contract DeployEscrowPool {
    EscrowDeployVm private constant vm =
        EscrowDeployVm(address(uint160(uint256(keccak256("hevm cheat code")))));

    function run() external returns (LoomonNativeEscrowPool pool) {
        uint256 deployerPrivateKey = vm.envUint("ARC_DEPLOYER_PRIVATE_KEY");
        address resolver = vm.addr(deployerPrivateKey);

        vm.startBroadcast(deployerPrivateKey);
        pool = new LoomonNativeEscrowPool(resolver);
        vm.stopBroadcast();
    }
}
