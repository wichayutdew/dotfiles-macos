function update --description 'Upgrade Homebrew packages, mise tools, and skills'
    set -l failed 0

    for manager in brew mise npx
        if not command -sq $manager
            printf 'Skipping %s: command not found\n' $manager
            continue
        end

        set -l args upgrade
        if test $manager = npx
            set args skills update
        end

        printf '\n==> %s %s\n' $manager (string join ' ' $args)
        command $manager $args
        set -l result $status
        if test $result -ne 0
            printf '%s update failed (exit %s)\n' $manager $result >&2
            set failed 1
        end
    end

    return $failed
end
