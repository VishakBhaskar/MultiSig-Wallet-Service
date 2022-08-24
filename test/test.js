const { expect } = require("chai");
const { ethers } = require("hardhat");
const {
  time,
  loadFixture,
} = require("@nomicfoundation/hardhat-network-helpers");

describe("Wallet", function () {
  async function deployWallet() {
    const numconfirmation = 4;

    const [owner1, owner2, owner3, owner4, owner5, newOwner, someUser] =
      await ethers.getSigners();

    // const owners = [owner1, owner2, owner3, owner4, owner5];

    const Wallet = await ethers.getContractFactory("MultiSigWallet");
    const wallet = await Wallet.deploy(
      [
        owner1.address,
        owner2.address,
        owner3.address,
        owner4.address,
        owner5.address,
      ],
      numconfirmation
    );

    const params = {
      to: wallet.address,
      value: ethers.utils.parseUnits("50", "ether"),
    };
    const txHash = await owner1.sendTransaction(params);
    console.log("Transaction Hash is:", txHash);

    return {
      wallet,
      owner1,
      owner2,
      owner3,
      owner4,
      owner5,
      newOwner,
      someUser,
      numconfirmation,
    };
  }

  describe("Deployment", function () {
    it("Should submit transaction", async function () {
      const { wallet, owner1, newOwner } = await loadFixture(deployWallet);
      const prevTxCount = await wallet.getTransactionCount();
      await wallet
        .connect(owner1)
        .submitTransaction(
          newOwner.address,
          ethers.utils.parseEther("1.2"),
          0x00
        );
      expect(await wallet.getTransactionCount()).to.equal(prevTxCount + 1);
    });

    it("Should submit, confirm and execute transaction", async function () {
      const { wallet, owner1, owner2, owner3, owner4, owner5, newOwner } =
        await loadFixture(deployWallet);

      const amount = ethers.utils.parseEther("1.2");
      await wallet
        .connect(owner1)
        .submitTransaction(newOwner.address, amount, 0x00);

      const balanceBeforeTransaction = await ethers.provider.getBalance(
        newOwner.address
      );

      const txIndex = (await wallet.getTransactionCount()) - 1;

      await wallet.connect(owner1).confirmTransaction(txIndex);
      await wallet.connect(owner2).confirmTransaction(txIndex);
      await wallet.connect(owner3).confirmTransaction(txIndex);
      await wallet.connect(owner4).confirmTransaction(txIndex);
      // await wallet.connect(owner5).confirmTransaction(txIndex);

      await wallet.connect(owner5).executeTransaction(txIndex);

      expect(await ethers.provider.getBalance(newOwner.address)).to.equal(
        balanceBeforeTransaction.add(amount)
      );
    });

    it("Submit, revert transaction if there aren't enough confirmations", async function () {
      const { wallet, owner1, owner2, owner3, owner4, owner5, newOwner } =
        await loadFixture(deployWallet);

      const amount = ethers.utils.parseEther("1.2");
      await wallet
        .connect(owner1)
        .submitTransaction(newOwner.address, amount, 0x00);

      const txIndex = (await wallet.getTransactionCount()) - 1;

      await wallet.connect(owner1).confirmTransaction(txIndex);
      await wallet.connect(owner2).confirmTransaction(txIndex);
      await wallet.connect(owner3).confirmTransaction(txIndex);

      await expect(
        wallet.connect(owner5).executeTransaction(txIndex)
      ).to.be.revertedWith("cannot execute tx");
    });

    it("Revert transaction if owner revokes confirmation", async function () {
      const { wallet, owner1, owner2, owner3, owner4, owner5, newOwner } =
        await loadFixture(deployWallet);

      const amount = ethers.utils.parseEther("1.2");
      await wallet
        .connect(owner1)
        .submitTransaction(newOwner.address, amount, 0x00);

      const txIndex = (await wallet.getTransactionCount()) - 1;

      await wallet.connect(owner1).confirmTransaction(txIndex);
      await wallet.connect(owner2).confirmTransaction(txIndex);
      await wallet.connect(owner3).confirmTransaction(txIndex);
      await wallet.connect(owner4).confirmTransaction(txIndex);
      await wallet.connect(owner5).confirmTransaction(txIndex);

      await wallet.connect(owner1).revokeConfirmation(txIndex);
      await wallet.connect(owner2).revokeConfirmation(txIndex);

      await expect(
        wallet.connect(owner5).executeTransaction(txIndex)
      ).to.be.revertedWith("cannot execute tx");
    });

    it("Prevents from resetting approvals to zero", async function () {
      const { wallet, owner1, owner2, owner3, owner4, owner5, newOwner } =
        await loadFixture(deployWallet);

      await wallet.connect(owner1).addOwner(newOwner.address);

      await wallet.connect(owner1).approveOwner(newOwner.address);
      await wallet.connect(owner2).approveOwner(newOwner.address);
      await wallet.connect(owner3).approveOwner(newOwner.address);

      await expect(
        wallet.connect(owner3).addOwner(newOwner.address)
      ).to.be.revertedWith("owner already added for approval");
    });

    it("Prevents from adding pre existing owner for approval", async function () {
      const { wallet, owner1, owner2, owner3, owner4, owner5, newOwner } =
        await loadFixture(deployWallet);

      await expect(
        wallet.connect(owner1).addOwner(owner4.address)
      ).to.be.revertedWith("is already owner");
    });

    it("Prevents from setting an owner without enough approvals", async function () {
      const { wallet, owner1, owner2, owner3, owner4, owner5, newOwner } =
        await loadFixture(deployWallet);

      await wallet.connect(owner1).addOwner(newOwner.address);

      await wallet.connect(owner1).approveOwner(newOwner.address);
      await wallet.connect(owner2).approveOwner(newOwner.address);
      await wallet.connect(owner3).approveOwner(newOwner.address);

      await expect(
        wallet.connect(owner1).setOwner(newOwner.address)
      ).to.be.revertedWith("Not enough approvals");
    });

    it("Adds new owner successfully", async function () {
      const {
        wallet,
        owner1,
        owner2,
        owner3,
        owner4,
        owner5,
        newOwner,
        someUser,
      } = await loadFixture(deployWallet);

      await wallet.connect(owner1).addOwner(newOwner.address);

      await wallet.connect(owner1).approveOwner(newOwner.address);
      await wallet.connect(owner2).approveOwner(newOwner.address);
      await wallet.connect(owner3).approveOwner(newOwner.address);
      await wallet.connect(owner4).approveOwner(newOwner.address);

      await expect(wallet.connect(owner1).setOwner(newOwner.address)).not.to.be
        .reverted;
    });

    it("Execute transaction after adding new owner", async function () {
      const {
        wallet,
        owner1,
        owner2,
        owner3,
        owner4,
        owner5,
        newOwner,
        someUser,
      } = await loadFixture(deployWallet);

      await wallet.connect(owner1).addOwner(newOwner.address);

      await wallet.connect(owner1).approveOwner(newOwner.address);
      await wallet.connect(owner2).approveOwner(newOwner.address);
      await wallet.connect(owner3).approveOwner(newOwner.address);
      await wallet.connect(owner4).approveOwner(newOwner.address);

      await wallet.connect(owner1).setOwner(newOwner.address);

      const amount = ethers.utils.parseEther("1.2");
      await wallet
        .connect(owner1)
        .submitTransaction(someUser.address, amount, 0x00);

      const balanceBeforeTransaction = await ethers.provider.getBalance(
        someUser.address
      );

      const txIndex = (await wallet.getTransactionCount()) - 1;

      await wallet.connect(owner1).confirmTransaction(txIndex);
      await wallet.connect(owner2).confirmTransaction(txIndex);
      await wallet.connect(owner3).confirmTransaction(txIndex);
      await wallet.connect(owner4).confirmTransaction(txIndex);
      await wallet.connect(newOwner).confirmTransaction(txIndex);

      await wallet.connect(owner5).executeTransaction(txIndex);

      expect(await ethers.provider.getBalance(someUser.address)).to.equal(
        balanceBeforeTransaction.add(amount)
      );
    });
  });
});
