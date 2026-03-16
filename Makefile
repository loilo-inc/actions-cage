VERSION ?= 0.0.0

.PHONY: build clean

build:
	node --import tsx ./tools/build.ts --version $(VERSION)

clean:
	rm -rf build
