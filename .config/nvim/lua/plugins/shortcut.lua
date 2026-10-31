-- Custom Shortcuts (File Paths & Git / GitLab)
return function()
	--------------------- FILE PATH KEYMAPS ---------------------
	vim.keymap.set("n", "<leader>cp", function()
		local path = vim.fn.expand("%:.")
		if path == "" then
			vim.notify("No file path available", vim.log.levels.WARN)
			return
		end
		vim.fn.setreg("+", path)
		vim.fn.setreg('"', path)
		vim.notify("Copied relative path: " .. path, vim.log.levels.INFO)
	end, { desc = "Copy relative path from pwd" })

	vim.keymap.set("n", "<leader>cP", function()
		local path = vim.fn.expand("%:p")
		if path == "" then
			vim.notify("No file path available", vim.log.levels.WARN)
			return
		end
		vim.fn.setreg("+", path)
		vim.fn.setreg('"', path)
		vim.notify("Copied full path: " .. path, vim.log.levels.INFO)
	end, { desc = "Copy full absolute path" })

	--------------------- GIT / GITLAB KEYMAPS ---------------------
	local function get_gitlab_url()
		local filepath = vim.api.nvim_buf_get_name(0)
		if filepath == "" then
			vim.notify("No file associated with current buffer", vim.log.levels.WARN)
			return nil
		end

		local filedir = vim.fn.fnamemodify(filepath, ":h")
		local git_root = vim.fn.systemlist({ "git", "-C", filedir, "rev-parse", "--show-toplevel" })[1]
		if vim.v.shell_error ~= 0 or not git_root or git_root == "" then
			vim.notify("Not in a git repository", vim.log.levels.WARN)
			return nil
		end

		local remote_url = vim.fn.systemlist({ "git", "-C", filedir, "config", "--get", "remote.origin.url" })[1]
		if not remote_url or remote_url == "" then
			local remotes = vim.fn.systemlist({ "git", "-C", filedir, "remote" })
			if #remotes > 0 and remotes[1] ~= "" then
				remote_url = vim.fn.systemlist({ "git", "-C", filedir, "config", "--get", "remote." .. remotes[1] .. ".url" })[1]
			end
		end

		if not remote_url or remote_url == "" then
			vim.notify("No git remote URL found", vim.log.levels.WARN)
			return nil
		end

		local function parse_remote(remote)
			remote = vim.trim(remote):gsub("%.git$", "")
			local host, path = remote:match("^git@([^:]+):(.+)$")
			if host and path then
				return "https://" .. host .. "/" .. path
			end
			host, path = remote:match("^ssh://[^@]+@([^/:]+):?%d*/(.+)$")
			if host and path then
				return "https://" .. host .. "/" .. path
			end
			local proto, rest = remote:match("^(https?)://(.+)$")
			if proto and rest then
				rest = rest:gsub("^[^/@]+@", "")
				return proto .. "://" .. rest
			end
			return nil
		end

		local base_url = parse_remote(remote_url)
		if not base_url then
			vim.notify("Could not parse git remote URL: " .. remote_url, vim.log.levels.ERROR)
			return nil
		end

		local branch = vim.fn.systemlist({ "git", "-C", filedir, "rev-parse", "--abbrev-ref", "HEAD" })[1]
		if not branch or branch == "" or branch == "HEAD" then
			branch = vim.fn.systemlist({ "git", "-C", filedir, "rev-parse", "HEAD" })[1]
		end
		if not branch or branch == "" then
			branch = "master"
		end

		local rel_path = vim.fn.systemlist({ "git", "-C", filedir, "ls-files", "--full-name", filepath })[1]
		if not rel_path or rel_path == "" then
			if filepath:sub(1, #git_root) == git_root then
				rel_path = filepath:sub(#git_root + 2)
			else
				rel_path = vim.fn.fnamemodify(filepath, ":.")
			end
		end

		local mode = vim.fn.mode()
		local is_visual = mode:match("[vV\22]") ~= nil
		local start_line, end_line

		if is_visual then
			start_line = vim.fn.line("v")
			end_line = vim.fn.line(".")
			if start_line > end_line then
				start_line, end_line = end_line, start_line
			end
			vim.api.nvim_feedkeys(vim.api.nvim_replace_termcodes("<Esc>", true, false, true), "n", true)
		else
			start_line = vim.api.nvim_win_get_cursor(0)[1]
			end_line = start_line
		end

		local is_gitlab = base_url:find("gitlab") ~= nil
		local blob_path = is_gitlab and "/-/blob/" or "/blob/"

		local line_anchor = ""
		if start_line and start_line > 0 then
			if start_line == end_line then
				line_anchor = "#L" .. start_line
			else
				line_anchor = is_gitlab and string.format("#L%d-%d", start_line, end_line)
					or string.format("#L%d-L%d", start_line, end_line)
			end
		end

		return string.format("%s%s%s/%s%s", base_url, blob_path, branch, rel_path, line_anchor)
	end

	vim.keymap.set({ "n", "v" }, "<leader>gl", function()
		local url = get_gitlab_url()
		if url then
			vim.ui.open(url)
			vim.notify("Opened in GitLab: " .. url, vim.log.levels.INFO)
		end
	end, { desc = "Open file in GitLab" })

	vim.keymap.set({ "n", "v" }, "<leader>gy", function()
		local url = get_gitlab_url()
		if url then
			vim.fn.setreg("+", url)
			vim.fn.setreg('"', url)
			vim.notify("Copied GitLab URL: " .. url, vim.log.levels.INFO)
		end
	end, { desc = "Copy GitLab URL" })
end
