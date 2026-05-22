-- Scala LSP (metals) + DAP Configuration
return function()
	local metals = require("metals")

	---------------------- Metals Config ---------------------
	local metals_config = metals.bare_config()

	metals_config.capabilities = vim.lsp.protocol.make_client_capabilities()

	metals_config.settings = {
		showImplicitArguments = true,
		showInferredType = true,
	}

	---------------------- Attach on FileType ---------------------
	vim.api.nvim_create_autocmd("FileType", {
		group = vim.api.nvim_create_augroup("metals", { clear = true }),
		pattern = { "scala", "sbt" },
		desc = "Attach metals LSP",
		callback = function()
			metals.initialize_or_attach(metals_config)
			metals.setup_dap()
		end,
	})
end
