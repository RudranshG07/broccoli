// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/GPURegistry.sol";

contract GPURegistryTest is Test {
    GPURegistry public registry;
    address public provider1 = address(0x1);
    address public provider2 = address(0x2);

    function setUp() public {
        registry = new GPURegistry();
    }

    function testRegisterGPU() public {
        vm.prank(provider1);
        uint256 gpuId = registry.registerGPU("RTX 4090", 24, 0.01 ether);

        assertEq(gpuId, 0);

        GPURegistry.GPU memory gpu = registry.getGPU(gpuId);
        assertEq(gpu.provider, provider1);
        assertEq(gpu.model, "RTX 4090");
        assertEq(gpu.vramGB, 24);
        assertEq(gpu.pricePerHour, 0.01 ether);
        assertTrue(gpu.available);
        assertEq(gpu.totalJobs, 0);
    }

    function testRegisterMultipleGPUs() public {
        vm.prank(provider1);
        uint256 gpu1 = registry.registerGPU("RTX 4090", 24, 0.01 ether);

        vm.prank(provider1);
        uint256 gpu2 = registry.registerGPU("RTX 3090", 12, 0.005 ether);

        vm.prank(provider2);
        uint256 gpu3 = registry.registerGPU("A100", 40, 0.05 ether);

        assertEq(gpu1, 0);
        assertEq(gpu2, 1);
        assertEq(gpu3, 2);
    }

    function testSetAvailability() public {
        vm.prank(provider1);
        uint256 gpuId = registry.registerGPU("RTX 4090", 24, 0.01 ether);

        vm.prank(provider1);
        registry.setAvailability(gpuId, false);

        GPURegistry.GPU memory gpu = registry.getGPU(gpuId);
        assertFalse(gpu.available);

        vm.prank(provider1);
        registry.setAvailability(gpuId, true);

        gpu = registry.getGPU(gpuId);
        assertTrue(gpu.available);
    }

    function testUpdatePrice() public {
        vm.prank(provider1);
        uint256 gpuId = registry.registerGPU("RTX 4090", 24, 0.01 ether);

        vm.prank(provider1);
        registry.updatePrice(gpuId, 0.02 ether);

        GPURegistry.GPU memory gpu = registry.getGPU(gpuId);
        assertEq(gpu.pricePerHour, 0.02 ether);
    }

    function testRevertNonOwnerSetAvailability() public {
        vm.prank(provider1);
        uint256 gpuId = registry.registerGPU("RTX 4090", 24, 0.01 ether);

        vm.prank(provider2);
        vm.expectRevert("Not GPU owner");
        registry.setAvailability(gpuId, false);
    }

    function testRevertNonOwnerUpdatePrice() public {
        vm.prank(provider1);
        uint256 gpuId = registry.registerGPU("RTX 4090", 24, 0.01 ether);

        vm.prank(provider2);
        vm.expectRevert("Not GPU owner");
        registry.updatePrice(gpuId, 0.02 ether);
    }

    function testGetAllGPUs() public {
        vm.prank(provider1);
        registry.registerGPU("RTX 4090", 24, 0.01 ether);

        vm.prank(provider1);
        registry.registerGPU("RTX 3090", 12, 0.005 ether);

        uint256[] memory allGPUs = registry.getAllGPUs();
        assertEq(allGPUs.length, 2);
        assertEq(allGPUs[0], 0);
        assertEq(allGPUs[1], 1);
    }

    function testGetProviderGPUs() public {
        vm.prank(provider1);
        registry.registerGPU("RTX 4090", 24, 0.01 ether);

        vm.prank(provider1);
        registry.registerGPU("RTX 3090", 12, 0.005 ether);

        vm.prank(provider2);
        registry.registerGPU("A100", 40, 0.05 ether);

        uint256[] memory provider1GPUs = registry.getProviderGPUs(provider1);
        assertEq(provider1GPUs.length, 2);

        uint256[] memory provider2GPUs = registry.getProviderGPUs(provider2);
        assertEq(provider2GPUs.length, 1);
    }

    function testGetAvailableGPUs() public {
        vm.prank(provider1);
        uint256 gpu1 = registry.registerGPU("RTX 4090", 24, 0.01 ether);

        vm.prank(provider1);
        registry.registerGPU("RTX 3090", 12, 0.005 ether);

        vm.prank(provider1);
        registry.setAvailability(gpu1, false);

        uint256[] memory availableGPUs = registry.getAvailableGPUs();
        assertEq(availableGPUs.length, 1);
        assertEq(availableGPUs[0], 1);
    }

    function testRevertEmptyModel() public {
        vm.prank(provider1);
        vm.expectRevert("Model cannot be empty");
        registry.registerGPU("", 24, 0.01 ether);
    }

    function testRevertZeroVRAM() public {
        vm.prank(provider1);
        vm.expectRevert("VRAM must be greater than 0");
        registry.registerGPU("RTX 4090", 0, 0.01 ether);
    }

    function testRevertZeroPrice() public {
        vm.prank(provider1);
        vm.expectRevert("Price must be greater than 0");
        registry.registerGPU("RTX 4090", 24, 0);
    }
}
