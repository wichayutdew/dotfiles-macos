function scp-folder --description 'Copy a folder to or from an SSH host'
    read -l -P 'Direction (upload/download): ' direction; or return 1
    switch (string lower -- "$direction")
        case upload download
            set direction (string lower -- "$direction")
        case '*'
            echo 'Choose upload or download.' >&2
            return 1
    end

    read -l -P 'SSH host (alias or user@host): ' host; or return 1
    if not string match -rq -- '^[A-Za-z0-9_][A-Za-z0-9_.-]*(@[A-Za-z0-9_][A-Za-z0-9_.-]*)?$' "$host"
        echo 'Enter a valid SSH host alias or user@host.' >&2
        return 1
    end

    set -l source
    set -l destination
    set -l local_path
    if test "$direction" = upload
        read -P 'Local source directory: ' source; or return 1
        read -P 'Remote destination directory: ' destination; or return 1
        set local_path "$source"
    else
        read -P 'Remote source directory: ' source; or return 1
        read -P 'Local destination directory: ' destination; or return 1
        set local_path "$destination"
    end

    if test -z "$source"; or test -z "$destination"
        echo 'Source and destination directories are required.' >&2
        return 1
    end

    # Prefix relative local paths so scp cannot mistake a colon or dash for a host or option.
    if string match -q -- '~/*' "$local_path"
        set local_path "$HOME"/(string sub -s 3 -- "$local_path")
    else if test "$local_path" = '~'
        set local_path "$HOME"
    else if not string match -q -- '/*' "$local_path"
        set local_path "./$local_path"
    end

    if test "$direction" = upload
        command scp -r "$local_path" "$host:$destination"
    else
        command scp -r "$host:$source" "$local_path"
    end
end
