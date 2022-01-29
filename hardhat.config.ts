import "@nomiclabs/hardhat-waffle";

module.exports = {
  solidity: {
		version: "0.5.17",
		settings: {
			optimizer: {
				enabled: true,
				runs: 200,
			},
		},
	},
};
