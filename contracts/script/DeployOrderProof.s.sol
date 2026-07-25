// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { LoomonOrderProof } from "../src/LoomonOrderProof.sol";

interface ProofDeployVm {
    function envUint(string calldata name) external returns (uint256);
    function addr(uint256 privateKey) external returns (address);
    function startBroadcast(uint256 privateKey) external;
    function stopBroadcast() external;
}

contract DeployOrderProof {
    ProofDeployVm private constant vm =
        ProofDeployVm(address(uint160(uint256(keccak256("hevm cheat code")))));

    function run() external returns (LoomonOrderProof proof) {
        uint256 deployerPrivateKey = vm.envUint("ARC_DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        vm.startBroadcast(deployerPrivateKey);
        proof = new LoomonOrderProof(deployer, deployer);
        vm.stopBroadcast();
    }
}
