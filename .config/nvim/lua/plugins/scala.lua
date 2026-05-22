-- Scala LSP (metals) + DAP Configuration
return function()
  local metals = require("metals")
  local dap = require("dap")

  ---------------------- Metals Config ---------------------
  local metals_config = metals.bare_config()

  metals_config.capabilities = vim.lsp.protocol.make_client_capabilities()

  metals_config.settings = {
    showImplicitArguments = true,
    showInferredType = true,
  }

  ---------------------- DAP Setup ---------------------
  metals.setup_dap()

  ---------------------- Attach on FileType ---------------------
  vim.api.nvim_create_autocmd("FileType", {
    pattern = { "scala", "sbt" },
    callback = function()
      metals.initialize_or_attach(metals_config)
    end,
  })
end
