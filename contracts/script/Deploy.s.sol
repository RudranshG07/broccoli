// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/GPURegistry.sol";
import "../src/JobMarketplace.sol";

contract DeployScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerPrivateKey);

        console.log("Deploying GPURegistry...");
        GPURegistry gpuRegistry = new GPURegistry();
        console.log("GPURegistry deployed at:", address(gpuRegistry));

        console.log("Deploying JobMarketplace...");
        JobMarketplace jobMarketplace = new JobMarketplace(address(gpuRegistry));
        console.log("JobMarketplace deployed at:", address(jobMarketplace));

        console.log("\n=== Deployment Summary ===");
        console.log("GPURegistry:", address(gpuRegistry));
        console.log("JobMarketplace:", address(jobMarketplace));
        console.log("========================\n");

        console.log("Save these addresses for your frontend config!");

        vm.stopBroadcast();
    }
}
