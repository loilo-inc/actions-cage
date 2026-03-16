VERSION ?= 0.0.0

.PHONY: build clean

build:
	node tools/build.mjs --version $(VERSION)

clean:
	rm -rf build
