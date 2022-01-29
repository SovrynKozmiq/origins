import { expect } from "chai";
import { ethers } from "hardhat";
import { BigNumber } from 'ethers';

describe("LockedFund.sol", () => {

    // Each signer has an account and we need access to their address
    type Account = { address: string };

    let admin1: Account;
    let admin2: Account;
    let nonAdmin: Account;

    // Define the "contract factories" that the ethers library provides
    // These factories deploy our contracts
    let lockedFundFactory: { 
        deploy: (arg0: number, arg1: string, arg2: string, arg3: string[]) => any;
    };

    // Semantically differentiate the SOV token and some generic token - probably not needed but it makes it clearer
    let sovrynTokenFactory: {
        deploy: (arg0: number, arg1: string, arg2: string, arg3: number) => any;
    }

    let genericTokenFactory: {
        deploy: (arg0: number, arg1: string, arg2: string, arg3: number) => any;
    }

    let vestingRegistryFactory: {
        deploy: (arg0: string, arg1: string, arg2: string, arg3: string, arg4: string) => any;
    }

    // The factory from VestingFactory.sol, since our actual contract appends "Factory" to the end this one has
    // it twice in the name to distinguish the deployer and the actual factory
    let vestingFactoryFactory: {
        deploy: (arg0: string) => any;
    }

    let vestingLogicFactory: {
        deploy: () => any;
    }

    let stakingFactory: {
        deploy: () => any;
    }

    // Define the contracts that the factories above deploy
    let lockedFund: { 
        address: string;

        // Sometimes we need to use the contract as a different user and these are the functions that we use in those cases
        connect: (arg0: Account) => { 
            addAdmin: { 
                (arg0: string): Promise<undefined>; 
            };
            removeAdmin: { 
                (arg0: string): Promise<undefined>; 
            };
            changeVestingRegistry: {
                (arg0: string): Promise<undefined>;
            }
            changeWaitedTS: { 
                (arg0: number): Promise<undefined>; 
            };
            depositVested: { 
                (arg0: string, arg1: number, arg2: number, arg3: number, arg4: number, arg5: number): Promise<undefined>;
            };
            depositWaitedUnlocked: {
                (arg0: string, arg1: number, arg2: number): Promise<undefined>
            };
        };

        // Computational functions
        addAdmin: (arg0: string) => Promise<undefined>;
        removeAdmin: (arg0: string) => Promise<undefined>;
        changeVestingRegistry: (arg0: string) => Promise<undefined>;
        changeWaitedTS: (arg0: number) => Promise<undefined>;
        depositWaitedUnlocked: (arg0: string, arg1: number, arg2: number) => Promise<undefined>;
        depositVested: (arg0: string, arg1: number, arg2: number, arg3: number, arg4: number, arg5: number) => Promise<undefined>;
        withdrawWaitedUnlockedBalance: (arg0: string) => Promise<undefined>;
        createVesting: () => Promise<string>;
        createVestingAndStake: () => Promise<undefined>;

        // Getters
        isAdmin: (arg0: string) => Promise<boolean>;
        vestingRegistry: () => Promise<string>;
        waitedTS: () => Promise<BigNumber>;
        getWaitedTS: () => Promise<BigNumber>;
        getToken: () => Promise<string>;
        getVestingDetails: () => Promise<string>;
        getVestedBalance: (arg0: string) => Promise<BigNumber>;
        getLockedBalance: (arg0: string) => Promise<BigNumber>;
        getWaitedUnlockedBalance: (arg0: string) => Promise<BigNumber>;
        getUnlockedBalance: (arg0: string) => Promise<BigNumber>;
        adminStatus: (arg0: string) => Promise<boolean>;
        getCliffAndDuration: (arg0: string) => Promise<[BigNumber, BigNumber]>;
        unlockedBalances: (arg0: string) => Promise<BigNumber>;
        vestedBalances: (arg0: string) => Promise<BigNumber>;
        waitedUnlockedBalances: (arg0: string) => Promise<BigNumber>;
        cliff: (arg0: string) => Promise<BigNumber>;
        duration: (arg0: string) => Promise<BigNumber>;
        token: () => Promise<string>;
    };

    let sovrynToken: { 
        address: string;

        connect: (arg0: any) => { 
            approve: (arg0: string, arg1: number) => any;
        }

        // Computation
        approve: (arg0: string, arg1: number) => any;
    };

    let genericToken: { 
        address: string;

        // Computation
        approve: (arg0: string, arg1: number) => any;
    };

    let vestingRegistry: {
        address: string;

        // Computation
        addAdmin: (arg0: string) => Promise<undefined>
    }

    // Our contract which deploys vesting contracts
    let vestingFactory: {
        address: string;

        // Computation
        transferOwnership: (arg0: string) => Promise<undefined>;
    }

    let vestingLogic: {
        address: string;
    }

    let stakingLogic: {
        address: string;
    }

    // Default values to initialize our tokens
    const TOKEN_TOTAL_SUPPLY = 1_000_000;
    const TOKEN_NAME = "Token";
    const TOKEN_SYMBOL = "TKN";
    const TOKEN_DECIMALS = 18;

    // Random timestamp for initialization of lockedFund
    const WAITED_TIMESTAMP = 1281098860;

    // Some cases test for address(0)
    const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

    // Note that I am using this dummy instead of deploying the feeSharingProxy because some "IProtocol" argument
    // is required and there is no code that I can find to make it a legitimate deployment therefore this hack will suffice
    const FEE_PROXY_ADDRESS = "0x0000000000000000000000000000000000000001";

    before(async () => {
        [admin1, admin2, nonAdmin] = await ethers.getSigners();
    });

    beforeEach(async () => {
        // Generic setup for all tests to keep it DRY (do not repeat yourself). 
        // Specific tests suites will override components when they need to
        lockedFundFactory  = await ethers.getContractFactory("LockedFund");
        sovrynTokenFactory = await ethers.getContractFactory("Token");
        genericTokenFactory = await ethers.getContractFactory("Token");
        vestingRegistryFactory = await ethers.getContractFactory("VestingRegistry3");
        vestingLogicFactory = await ethers.getContractFactory("VestingLogic");
        vestingFactoryFactory = await ethers.getContractFactory("VestingFactory");
        stakingFactory = await ethers.getContractFactory("Staking");

        sovrynToken = await sovrynTokenFactory.deploy(TOKEN_TOTAL_SUPPLY, TOKEN_NAME, TOKEN_SYMBOL, TOKEN_DECIMALS);
        genericToken = await genericTokenFactory.deploy(TOKEN_TOTAL_SUPPLY, TOKEN_NAME, TOKEN_SYMBOL, TOKEN_DECIMALS);
        vestingLogic = await vestingLogicFactory.deploy();
        vestingFactory = await vestingFactoryFactory.deploy(vestingLogic.address);
        stakingLogic = await stakingFactory.deploy();
        vestingRegistry = await vestingRegistryFactory.deploy(vestingFactory.address, sovrynToken.address, stakingLogic.address, FEE_PROXY_ADDRESS, admin1.address);
        lockedFund = await lockedFundFactory.deploy(WAITED_TIMESTAMP, genericToken.address, vestingRegistry.address, [admin1.address, admin2.address]);
    });

    // DONE
    describe("function constructor()", () => {

        it("Reverts on waitedTS == 0", () => {
            expect(lockedFundFactory.deploy(0, genericToken.address, vestingRegistry.address, [admin1.address])).to.be.revertedWith("LockedFund: Waited TS cannot be zero.");
        });

        it("Reverts on token address == address(0)", () => {
            expect(lockedFundFactory.deploy(WAITED_TIMESTAMP, ZERO_ADDRESS, vestingRegistry.address, [admin1.address])).to.be.revertedWith("LockedFund: Invalid Token Address.");
        });

        it("Reverts on vestingRegistry address == address(0)", () => {
            expect(lockedFundFactory.deploy(WAITED_TIMESTAMP, genericToken.address, ZERO_ADDRESS, [admin1.address])).to.be.revertedWith("LockedFund: Vesting registry address is invalid.");
        });

        it("Reverts on admin address == address(0)", () => {
            expect(lockedFundFactory.deploy(WAITED_TIMESTAMP, genericToken.address, vestingRegistry.address, [ZERO_ADDRESS])).to.be.revertedWith("LockedFund: Invalid Address.");
        });

        it("Fully deploys the contract [TODO: how to test events emitted from constructor?]", async () => {          
            expect(await lockedFund.waitedTS()).to.equal(WAITED_TIMESTAMP);
            expect(await lockedFund.token()).to.equal(genericToken.address);
            expect(await lockedFund.vestingRegistry()).to.equal(vestingRegistry.address);
            expect(await lockedFund.isAdmin(admin1.address)).to.be.true;
            expect(await lockedFund.isAdmin(admin2.address)).to.be.true;
            // Two expect statements for AdminAdded events should be added
        });

    });

    // DONE
    describe("function addAdmin()", () => {

        it("Reverts on non-admin use", () => {
            expect(lockedFund.connect(nonAdmin).addAdmin(nonAdmin.address)).to.be.revertedWith("LockedFund: Only admin can call this."); 
        });

        it("Reverts on admin address == address(0)", () => {            
            expect(lockedFund.addAdmin(ZERO_ADDRESS)).to.be.revertedWith("LockedFund: Invalid Address."); 
        });

        it("Reverts on admin being re-added when already admin", () => {
            expect(lockedFund.addAdmin(admin1.address)).to.be.revertedWith("LockedFund: Address is already admin."); 
        });

        it("Adds an admin and emits event", async () => {
            expect(await lockedFund.isAdmin(nonAdmin.address)).to.be.false;
            expect(lockedFund.addAdmin(nonAdmin.address)).to.emit(lockedFund, "AdminAdded").withArgs(admin1.address, nonAdmin.address);
            expect(await lockedFund.isAdmin(nonAdmin.address)).to.be.true;
        });

    });

    // DONE
    describe("function removeAdmin()", () => {

        it("Reverts on non-admin use", () => {           
            expect(lockedFund.connect(nonAdmin).removeAdmin(admin1.address)).to.be.revertedWith("LockedFund: Only admin can call this."); 
        });
        
        it("Reverts on removing non-admin", () => {
            expect(lockedFund.removeAdmin(nonAdmin.address)).to.be.revertedWith("LockedFund: Address is not an admin."); 
        });

        it("Removes admin and emits event", async () => {
            expect(await lockedFund.isAdmin(admin2.address)).to.be.true;
            expect(await lockedFund.removeAdmin(admin2.address)).to.emit(lockedFund, "AdminRemoved").withArgs(admin1.address, admin2.address);
            expect(await lockedFund.isAdmin(admin2.address)).to.be.false;
        });

    });

    // DONE
    describe("function changeVestingRegistry()", () => {

        const NEW_REGISTRY_ADDRESS = "0x3000000000000000000000000000000000000000"; 

        it("Reverts on non-admin use", () => {
            expect(lockedFund.connect(nonAdmin).changeVestingRegistry(NEW_REGISTRY_ADDRESS)).to.be.revertedWith("LockedFund: Only admin can call this."); 
        });
        
        it("Reverts on vestingRegistry address == address(0)", () => {          
            expect(lockedFund.changeVestingRegistry(ZERO_ADDRESS)).to.be.revertedWith("LockedFund: Vesting registry address is invalid."); 
        });

        it("Changes vestingRegistry and emits event", async () => {
            const initialRegistry = await lockedFund.vestingRegistry();

            expect(await lockedFund.changeVestingRegistry(NEW_REGISTRY_ADDRESS)).to.emit(lockedFund, "VestingRegistryUpdated").withArgs(admin1.address, NEW_REGISTRY_ADDRESS);
            expect(initialRegistry).to.equal(vestingRegistry.address);
            expect(await lockedFund.vestingRegistry()).to.equal(NEW_REGISTRY_ADDRESS);
        });

    });

    // DONE
    describe("function changeWaitedTS()", () => {

        it("Reverts on non-admin use", () => {            
            expect(lockedFund.connect(nonAdmin).changeWaitedTS(WAITED_TIMESTAMP + 1)).to.be.revertedWith("LockedFund: Only admin can call this."); 
        });
        
        it("Reverts on waitedTS == 0", () => {
            expect(lockedFund.changeWaitedTS(0)).to.be.revertedWith("LockedFund: Waited TS cannot be zero."); 
        });

        it("Changes waitedTS and emits event", async () => {
            const newWaitedTS = WAITED_TIMESTAMP + 1;
            const initialWaitedTS = await lockedFund.waitedTS();

            expect(await lockedFund.changeWaitedTS(newWaitedTS)).to.emit(lockedFund, "WaitedTSUpdated").withArgs(admin1.address, newWaitedTS);
            expect(initialWaitedTS).to.equal(WAITED_TIMESTAMP);
            expect(await lockedFund.waitedTS()).to.equal(newWaitedTS);
        });

    });

    // DONE
    describe("function depositVested()", () => {

        const TOKEN_TRANSFER_AMOUNT = 1_000;
        const CLIFF = 1;
        const INTERVAL = 60 * 60 * 24 * 7 * 4;
        const MAX_BASIS_POINT = 10_000;
        
        it("Reverts on non-admin use", () => {
            const duration = 15;
            const basisPoint = 1;
            const unlockedOrWaited = 1;
            
            expect(lockedFund.connect(nonAdmin).depositVested(nonAdmin.address, TOKEN_TRANSFER_AMOUNT, CLIFF, duration, basisPoint, unlockedOrWaited)).to.be.revertedWith("LockedFund: Only admin can call this.");
        });

        it("Reverts on duration == 0", () => {
            const duration = 0;
            const basisPoint = 10;
            const unlockedOrWaited = 1;

            expect(lockedFund.depositVested(admin1.address, TOKEN_TRANSFER_AMOUNT, CLIFF, duration, basisPoint, unlockedOrWaited)).to.be.revertedWith("LockedFund: Duration cannot be zero.");
        });

        it("Reverts on duration being greater than limit", () => {
            const duration = 50;
            const basisPoint = 10;
            const unlockedOrWaited = 1;

            expect(lockedFund.depositVested(admin1.address, TOKEN_TRANSFER_AMOUNT, CLIFF, duration, basisPoint, unlockedOrWaited)).to.be.revertedWith("LockedFund: Duration is too long.");
        });

        it("Reverts on basisPoint being greater than limit", () => {
            const duration = 30;
            const basisPoint = 10000;
            const unlockedOrWaited = 1;

            expect(lockedFund.depositVested(admin1.address, TOKEN_TRANSFER_AMOUNT, CLIFF, duration, basisPoint, unlockedOrWaited)).to.be.revertedWith("LockedFund: Basis Point has to be less than 10000.");
        });

        it("UnlockType is Immediate [TODO: when unlocked deposit event is added it should be emitted]", async () => {
            const duration = 15;
            const basisPoint = 100;
            const unlockedOrWaited = 1;
            const unlockedBalance = TOKEN_TRANSFER_AMOUNT * basisPoint / MAX_BASIS_POINT;

            await genericToken.approve(lockedFund.address, TOKEN_TRANSFER_AMOUNT);

            expect(await lockedFund.unlockedBalances(admin1.address)).to.equal(0);
            expect(await lockedFund.vestedBalances(admin1.address)).to.equal(0);
            expect(await lockedFund.cliff(admin1.address)).to.equal(0);
            expect(await lockedFund.duration(admin1.address)).to.equal(0);

            expect(await lockedFund.depositVested(admin1.address, TOKEN_TRANSFER_AMOUNT, CLIFF, duration, basisPoint, unlockedOrWaited)).to.emit(lockedFund, "VestedDeposited").withArgs(admin1.address, admin1.address, TOKEN_TRANSFER_AMOUNT, CLIFF, duration, basisPoint);

            expect(await lockedFund.unlockedBalances(admin1.address)).to.equal(unlockedBalance);
            expect(await lockedFund.vestedBalances(admin1.address)).to.equal(TOKEN_TRANSFER_AMOUNT - unlockedBalance);
            expect(await lockedFund.cliff(admin1.address)).to.equal(CLIFF * INTERVAL);
            expect(await lockedFund.duration(admin1.address)).to.equal(duration * INTERVAL);
        });

        it("UnlockType is Waited [TODO: when waited unlocked deposit event is added it should be emitted]", async () => {
            const duration = 15;
            const basisPoint = 100;
            const unlockedOrWaited = 2;
            const unlockedBalance = TOKEN_TRANSFER_AMOUNT * basisPoint / MAX_BASIS_POINT;

            await genericToken.approve(lockedFund.address, TOKEN_TRANSFER_AMOUNT);

            expect(await lockedFund.waitedUnlockedBalances(admin1.address)).to.equal(0);
            expect(await lockedFund.vestedBalances(admin1.address)).to.equal(0);
            expect(await lockedFund.cliff(admin1.address)).to.equal(0);
            expect(await lockedFund.duration(admin1.address)).to.equal(0);

            expect(await lockedFund.depositVested(admin1.address, TOKEN_TRANSFER_AMOUNT, CLIFF, duration, basisPoint, unlockedOrWaited)).to.emit(lockedFund, "VestedDeposited").withArgs(admin1.address, admin1.address, TOKEN_TRANSFER_AMOUNT, CLIFF, duration, basisPoint);

            expect(await lockedFund.waitedUnlockedBalances(admin1.address)).to.equal(unlockedBalance);
            expect(await lockedFund.vestedBalances(admin1.address)).to.equal(TOKEN_TRANSFER_AMOUNT - unlockedBalance);
            expect(await lockedFund.cliff(admin1.address)).to.equal(CLIFF * INTERVAL);
            expect(await lockedFund.duration(admin1.address)).to.equal(duration * INTERVAL);
        });

        it("UnlockType is other", async () => {
            const duration = 15;
            const basisPoint = 100;
            const unlockedOrWaited = 0;

            await genericToken.approve(lockedFund.address, TOKEN_TRANSFER_AMOUNT);

            expect(await lockedFund.unlockedBalances(admin1.address)).to.equal(0);
            expect(await lockedFund.waitedUnlockedBalances(admin1.address)).to.equal(0);
            expect(await lockedFund.vestedBalances(admin1.address)).to.equal(0);
            expect(await lockedFund.cliff(admin1.address)).to.equal(0);
            expect(await lockedFund.duration(admin1.address)).to.equal(0);

            expect(await lockedFund.depositVested(admin1.address, TOKEN_TRANSFER_AMOUNT, CLIFF, duration, basisPoint, unlockedOrWaited)).to.emit(lockedFund, "VestedDeposited").withArgs(admin1.address, admin1.address, TOKEN_TRANSFER_AMOUNT, CLIFF, duration, basisPoint);

            expect(await lockedFund.unlockedBalances(admin1.address)).to.equal(0);
            expect(await lockedFund.waitedUnlockedBalances(admin1.address)).to.equal(0);
            expect(await lockedFund.vestedBalances(admin1.address)).to.equal(TOKEN_TRANSFER_AMOUNT);
            expect(await lockedFund.cliff(admin1.address)).to.equal(CLIFF * INTERVAL);
            expect(await lockedFund.duration(admin1.address)).to.equal(duration * INTERVAL);
        });

    });

    describe.skip("function depositLocked() [TODO: function is not written]", () => {});

    // DONE
    describe("function depositWaitedUnlocked()", () => {

        const TOKEN_TRANSFER_AMOUNT = 1_000;

        it("Reverts on non-admin use", () => {
            expect(lockedFund.connect(nonAdmin).depositWaitedUnlocked(nonAdmin.address, TOKEN_TRANSFER_AMOUNT, 1)).to.be.revertedWith("LockedFund: Only admin can call this.");
        });
        
        it("Reverts on basisPoint being greater than limit", () => {
            expect(lockedFund.depositWaitedUnlocked(nonAdmin.address, TOKEN_TRANSFER_AMOUNT, 10_001)).to.be.revertedWith("LockedFund: Basis Point has to be less than 10000.");
        });

        it("Unlock balance is greater than 0", async () => {
            const basisPoint = 10;
            
            await genericToken.approve(lockedFund.address, TOKEN_TRANSFER_AMOUNT);

            expect(await lockedFund.unlockedBalances(nonAdmin.address)).to.equal(0);
            expect(await lockedFund.waitedUnlockedBalances(nonAdmin.address)).to.equal(0);
            expect(lockedFund.depositWaitedUnlocked(nonAdmin.address, TOKEN_TRANSFER_AMOUNT, basisPoint)).to.emit(lockedFund, "WaitedUnlockedDeposited").withArgs(admin1.address, nonAdmin.address, TOKEN_TRANSFER_AMOUNT, basisPoint);
            expect(await lockedFund.unlockedBalances(nonAdmin.address)).to.equal(1);
            expect(await lockedFund.waitedUnlockedBalances(nonAdmin.address)).to.equal(999);
        });

        it("Unlock balance is 0", async () => {
            const basisPoint = 1;
            
            await genericToken.approve(lockedFund.address, TOKEN_TRANSFER_AMOUNT);

            expect(await lockedFund.unlockedBalances(nonAdmin.address)).to.equal(0);
            expect(await lockedFund.waitedUnlockedBalances(nonAdmin.address)).to.equal(0);
            expect(lockedFund.depositWaitedUnlocked(nonAdmin.address, TOKEN_TRANSFER_AMOUNT, basisPoint)).to.emit(lockedFund, "WaitedUnlockedDeposited").withArgs(admin1.address, nonAdmin.address, TOKEN_TRANSFER_AMOUNT, basisPoint);
            expect(await lockedFund.unlockedBalances(nonAdmin.address)).to.equal(0);
            expect(await lockedFund.waitedUnlockedBalances(nonAdmin.address)).to.equal(1000);
        });

    });

    // DONE
    describe("function withdrawWaitedUnlockedBalance()", () => {
        
        const TOKEN_TRANSFER_AMOUNT = 1_000;
        const CLIFF = 1;
        const DURATION = 15;
        const BASIS_POINT = 100;
        const UNLOCKED_OR_WAITED = 2;

        it("Reverts on waitedTS being greater than block.timestamp", async () => {
            const latestBlock = await ethers.provider.getBlock("latest");
            const newWaitedTS = latestBlock.timestamp + 10000000;
            const lockedFund = await lockedFundFactory.deploy(newWaitedTS, genericToken.address, vestingRegistry.address, [admin1.address, admin2.address]);

            await expect(lockedFund.withdrawWaitedUnlockedBalance(ZERO_ADDRESS)).to.revertedWith("LockedFund: Wait Timestamp not yet passed.");
        });

        it("Withdraws balance for receiver address == address(0)", async () => {
            await genericToken.approve(lockedFund.address, TOKEN_TRANSFER_AMOUNT);
            await lockedFund.depositVested(admin1.address, TOKEN_TRANSFER_AMOUNT, CLIFF, DURATION, BASIS_POINT, UNLOCKED_OR_WAITED);

            expect(await lockedFund.waitedUnlockedBalances(admin1.address)).to.equal(10);
            expect(await lockedFund.withdrawWaitedUnlockedBalance(ZERO_ADDRESS)).to.emit(lockedFund, "WithdrawnWaitedUnlockedBalance").withArgs(admin1.address, admin1.address, 10);
            expect(await lockedFund.waitedUnlockedBalances(admin1.address)).to.equal(0);
        });

        it("Withdraws balance for valid receiver address", async () => {
            await genericToken.approve(lockedFund.address, TOKEN_TRANSFER_AMOUNT);
            await lockedFund.depositVested(admin1.address, TOKEN_TRANSFER_AMOUNT, CLIFF, DURATION, BASIS_POINT, UNLOCKED_OR_WAITED);

            expect(await lockedFund.waitedUnlockedBalances(admin1.address)).to.equal(10);
            expect(await lockedFund.withdrawWaitedUnlockedBalance(admin1.address)).to.emit(lockedFund, "WithdrawnWaitedUnlockedBalance").withArgs(admin1.address, admin1.address, 10);
            expect(await lockedFund.waitedUnlockedBalances(admin1.address)).to.equal(0);
        });

    });

    describe.skip("function createVestingAndStake() [TODO: see comments in test]", () => {

        // Similar problem to comments in createVesting() where I need to get the newly deployed vesting address
        // I think I need to approve the lockedFund with the address but since idk how to fetch it
        // Since I cannot fetch it, it means I cannot use it to approve a transfer and thus tests revert

        const TOKEN_TRANSFER_AMOUNT = 1_000;
        const MAX_BASIS_POINT = 10_000;
        const CLIFF = 1;
        const DURATION = 15;
        const BASIS_POINT = 100;
        const UNLOCKED_OR_WAITED = 1;
        const UNLOCKED_BALANCE = TOKEN_TRANSFER_AMOUNT * BASIS_POINT / MAX_BASIS_POINT;

        it.skip("Creates the vesting when vestingAddr == address(0) [TODO: incomplete test]", async () => {
            await genericToken.approve(lockedFund.address, TOKEN_TRANSFER_AMOUNT);
            // await sovrynToken.connect(lockedFund).approve("<newly created vesting address>", tokenTransferAmount);
            await lockedFund.depositVested(admin1.address, TOKEN_TRANSFER_AMOUNT, CLIFF, DURATION, BASIS_POINT, UNLOCKED_OR_WAITED);
            await vestingRegistry.addAdmin(lockedFund.address);
            await vestingFactory.transferOwnership(vestingRegistry.address);

            const initialVestedBalance = await lockedFund.vestedBalances(admin1.address);
            await lockedFund.createVestingAndStake();

            expect(initialVestedBalance).to.equal(TOKEN_TRANSFER_AMOUNT - UNLOCKED_BALANCE)

            // In the end the vesting balance should be 0
            // expect(await lockedFund.vestedBalances(admin1.address)).to.equal(0);

            // We should also emit the TokenStaked event on the next line
        });

        it.skip("Stakes the tokens [TODO: incomplete test]", async () => {
            await genericToken.approve(lockedFund.address, TOKEN_TRANSFER_AMOUNT);
            // await sovrynToken.connect(lockedFund).approve("<newly created vesting address>", tokenTransferAmount);
            await lockedFund.depositVested(admin1.address, TOKEN_TRANSFER_AMOUNT, CLIFF, DURATION, BASIS_POINT, UNLOCKED_OR_WAITED);
            await vestingRegistry.addAdmin(lockedFund.address);
            await vestingFactory.transferOwnership(vestingRegistry.address);
            
            const transaction: any = await lockedFund.createVesting();

            const initialVestedBalance = await lockedFund.vestedBalances(admin1.address);
            await lockedFund.createVestingAndStake();

            expect(initialVestedBalance).to.equal(TOKEN_TRANSFER_AMOUNT - UNLOCKED_BALANCE)

            // In the end the vesting balance should be 0
            // expect(await lockedFund.vestedBalances(admin1.address)).to.equal(0);

            // We should also emit the TokenStaked event on the next line
        });

    });

    describe("function createVesting()", () => {
        
        it("Reverts on cliff == 0", async () => {
            const tokenTransferAmount = 1_000;
            const cliff = 0;
            const duration = 15;
            const basisPoint = 100;
            const unlockedOrWaited = 1;

            await genericToken.approve(lockedFund.address, tokenTransferAmount);
            await lockedFund.depositVested(admin1.address, tokenTransferAmount, cliff, duration, basisPoint, unlockedOrWaited);
            
            expect(lockedFund.createVesting()).to.be.revertedWith("LockedFund: Cliff and/or Duration not set.");
        });

        it.skip("Reverts on duration == 0 [TODO: untestable, see test comments]", () => {
            // This cannot be tested because there is no way to set the cliff without setting the duration
            // (or just the duration). You can only set both using depositVested however that requires the duration != 0
        });

        it("Creates the vesting [TODO: incomplete test, see test comments]", async () => {
            // Here we only check for the event at the end since nothing gets set in storage
            // Typically, we would not test "external" (vesting) code so should we be testing
            // it here too? The Registry code should be tested only as far as the registry cares
            // in its own suite
            const tokenTransferAmount = 1_000;
            const cliff = 1;
            const duration = 15;
            const basisPoint = 100;
            const unlockedOrWaited = 1;

            await genericToken.approve(lockedFund.address, tokenTransferAmount);
            await lockedFund.depositVested(admin1.address, tokenTransferAmount, cliff, duration, basisPoint, unlockedOrWaited);
            await vestingRegistry.addAdmin(lockedFund.address);
            await vestingFactory.transferOwnership(vestingRegistry.address);
            
            const transaction: any = await lockedFund.createVesting();
            const minedTx = await transaction.wait();
            const event = minedTx.events.find((e: any) => e.event === 'VestingCreated');

            expect(event.args._initiator).to.equal(admin1.address);
            expect(event.args._userAddress).to.equal(admin1.address);

            // What is a good way to get this address ahead of time so that we can test the full event?
            // expect(event.args._vesting).to.equal("?");
        });

    });

    describe.skip("function stakeTokens() [TODO: see comments in test]", () => {

        // Same comments as in the createVestingAndStake() test suite

        it("Reverts on cliff != vesting.cliff()");

        it("Reverts on duration != vesting.duration()");

        it("Stakes the tokens");
        
    });

    describe.skip("function withdrawAndStakeTokens() [TODO: incomplete function]", () => {});

    describe.skip("function withdrawUnlockedBalance() [TODO: function is commented out in withdrawAndStakeTokens()]", () => {

        // Should this be tested?

        it("Withdraws balance for receiver address == address(0)");

        it("Withdraws balance for receiver address != address(0)");

    });

    // DONE
    describe("function getWaitedTS()", () => {

        it("Gets the waitedTS", async () => {
            expect(await lockedFund.getWaitedTS()).to.equal(await lockedFund.waitedTS());
        });

    });

    // DONE
    describe("function getToken()", () => {

        it("Gets the genericToken address", async () => {
            expect(await lockedFund.getToken()).to.equal(genericToken.address);
        });

    });

    // DONE
    describe("function getVestingDetails()", () => {

        it("Gets the genericToken address", async () => {
            expect(await lockedFund.getVestingDetails()).to.equal(vestingRegistry.address);
        });
        
    });

    // DONE
    describe("function getVestedBalance()", () => {

        it("Returns the non-zero balance of a user that has vested", async () => {
            const tokenTransferAmount = 1_000;
            const cliff = 1;
            const duration = 15;
            const basisPoint = 100;
            const unlockedOrWaited = 1;

            await genericToken.approve(lockedFund.address, tokenTransferAmount);
            await lockedFund.depositVested(admin1.address, tokenTransferAmount, cliff, duration, basisPoint, unlockedOrWaited);

            expect(await lockedFund.getVestedBalance(admin1.address)).to.equal(990);
        });

        it("Returns the balance of 0 for a user that has not vested", async () => {
            expect(await lockedFund.getVestedBalance(admin1.address)).to.equal(0);
        });
        
    });

    // DONE
    describe("function getLockedBalance()", () => {

        it.skip("Returns the non-zero locked balance of a user that has locked their balance [TODO: untestable, see test comments]", () => {
            // There is nothing that sets this value therefore this cannot be tested atm
        });

        it("Returns the locked balance of 0 for a user that has not locked their balance", async () => {
            expect(await lockedFund.getLockedBalance(admin1.address)).to.equal(0);
        });

    });

    // DONE
    describe("function getWaitedUnlockedBalance()", () => {

        it("Returns the non-zero waited unlocked balance of a user that has an unlocked balance", async () => {
            const tokenTransferAmount = 1_000;
            const cliff = 1;
            const duration = 15;
            const basisPoint = 100;
            const unlockedOrWaited = 2;

            await genericToken.approve(lockedFund.address, tokenTransferAmount);
            await lockedFund.depositVested(admin1.address, tokenTransferAmount, cliff, duration, basisPoint, unlockedOrWaited);

            expect(await lockedFund.getWaitedUnlockedBalance(admin1.address)).to.equal(10);
        });

        it("Returns the waited unlocked balance of 0 for a user that does not have an unlocked balance", async () => {
            expect(await lockedFund.getWaitedUnlockedBalance(admin1.address)).to.equal(0);
        });
        
    });

    // DONE
    describe("function getUnlockedBalance()", () => {

        it("Returns the non-zero unlocked balance of a user that has an unlocked balance", async () => {
            const tokenTransferAmount = 1_000;
            const cliff = 1;
            const duration = 15;
            const basisPoint = 100;
            const unlockedOrWaited = 1;

            await genericToken.approve(lockedFund.address, tokenTransferAmount);
            await lockedFund.depositVested(admin1.address, tokenTransferAmount, cliff, duration, basisPoint, unlockedOrWaited);

            expect(await lockedFund.getUnlockedBalance(admin1.address)).to.equal(10);
        });

        it("Returns the unlocked balance of 0 for a user that does not have an unlocked balance", async () => {
            expect(await lockedFund.getUnlockedBalance(admin1.address)).to.equal(0);
        });

    });

    // DONE
    describe("function adminStatus()", () => {

        it("Returns false for a non-admin", async () => {
            expect(await lockedFund.adminStatus(nonAdmin.address)).to.be.false;
        });

        it("Returns true for an admin", async () => {
            expect(await lockedFund.adminStatus(admin1.address)).to.be.true;
        });
        
    });

    // DONE
    describe("function getCliffAndDuration()", () => {

        const INTERVAL = 60 * 60 * 24 * 7 * 4;

        it("Gets the cliff and duration of a user", async () => {
            const tokenTransferAmount = 1_000;
            const cliff = 1;
            const duration = 15;
            const basisPoint = 100;
            const unlockedOrWaited = 1;

            await genericToken.approve(lockedFund.address, tokenTransferAmount);
            await lockedFund.depositVested(admin1.address, tokenTransferAmount, cliff, duration, basisPoint, unlockedOrWaited);

            const result = await lockedFund.getCliffAndDuration(admin1.address);
            expect(result[0]).to.equal(cliff * INTERVAL);
            expect(result[1]).to.equal(duration * INTERVAL);
        });

        it("Gets the cliff and duration of 0 for a non-user", async () => {
            const result = await lockedFund.getCliffAndDuration(nonAdmin.address);
            expect(result[0]).to.equal(0);
            expect(result[1]).to.equal(0);
        });
        
    });
    
})


