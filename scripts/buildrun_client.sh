cd client
mkdir -p build
babel renderer --out-dir build --copy-files --source-maps inline
./node_modules/.bin/electron .
