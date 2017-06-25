cd client
mkdir -p build
./node_modules/.bin/babel renderer --out-dir build --copy-files --source-maps inline --presets es2015,react
./node_modules/.bin/electron .
