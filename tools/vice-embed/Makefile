SHELL := /bin/sh
.DEFAULT_GOAL := package

VICE_VERSION := 3.10.0
VICE_TAG := v3.10
VICE_SVN_URL := https://svn.code.sf.net/p/vice-emu/code/tags/$(VICE_TAG)/vice
PATCH_FILE := $(CURDIR)/vice-$(VICE_VERSION)-commodore-embed.patch

BUILD_DIR ?= $(CURDIR)/build
SOURCE_DIR ?= $(BUILD_DIR)/vice-$(VICE_VERSION)
PREFIX_DIR ?= $(BUILD_DIR)/prefix
DIST_ROOT ?= $(CURDIR)/dist
PLATFORM ?= darwin-arm64
JOBS ?= $(shell sysctl -n hw.ncpu 2>/dev/null || nproc 2>/dev/null || echo 4)
VICE_CONFIGURE_FLAGS ?= --enable-sdl2ui
VICE_CODESIGN_IDENTITY ?= -

REPO_ROOT := $(abspath $(CURDIR)/../..)
CHECKOUT_STAMP := $(BUILD_DIR)/.checkout-$(VICE_TAG)
PATCH_STAMP := $(BUILD_DIR)/.patched-$(VICE_VERSION)
CONFIGURE_STAMP := $(BUILD_DIR)/.configured-$(VICE_VERSION)
INSTALL_STAMP := $(BUILD_DIR)/.installed-$(VICE_VERSION)

APP_DIR := $(DIST_ROOT)/$(PLATFORM)/VICE.app
APP_CONTENTS_DIR := $(APP_DIR)/Contents
APP_RESOURCES_DIR := $(APP_CONTENTS_DIR)/Resources
APP_MACOS_DIR := $(APP_CONTENTS_DIR)/MacOS
PACKAGE_STAMP := $(APP_RESOURCES_DIR)/.commodore-commander-patched-vice
ASSETS_APP_DIR := $(REPO_ROOT)/packages/theia-extension/assets/vice/darwin-arm64/VICE.app

.PHONY: help package assets source patch configure build install stage bundle-dylibs sign verify clean distclean check-platform check-prereqs

help:
	 @echo "Targets:"
	 @echo "  make package    Build and stage patched VICE at $(APP_DIR)"
	 @echo "  make assets     Build patched VICE and copy it into packages/theia-extension/assets"
	 @echo "  make source     Export upstream VICE $(VICE_VERSION) source"
	 @echo "  make clean      Remove build and dist outputs"
	 @echo
	 @echo "Variables:"
	 @echo "  PLATFORM=$(PLATFORM)"
	 @echo "  JOBS=$(JOBS)"
	 @echo "  VICE_CONFIGURE_FLAGS=$(VICE_CONFIGURE_FLAGS)"
	 @echo "  VICE_CODESIGN_IDENTITY=$(VICE_CODESIGN_IDENTITY)"

package: check-platform check-prereqs $(PACKAGE_STAMP) bundle-dylibs sign verify

assets: package
	rm -rf "$(ASSETS_APP_DIR)"
	mkdir -p "$(dir $(ASSETS_APP_DIR))"
	cp -R "$(APP_DIR)" "$(ASSETS_APP_DIR)"
	 find "$(ASSETS_APP_DIR)" -name .DS_Store -delete
	 @echo "Copied patched VICE to $(ASSETS_APP_DIR)"

source: $(CHECKOUT_STAMP)

patch: $(PATCH_STAMP)

configure: $(CONFIGURE_STAMP)

build: configure
	 $(MAKE) -C "$(SOURCE_DIR)" -j"$(JOBS)"

install: $(INSTALL_STAMP)

stage: $(PACKAGE_STAMP)

$(CHECKOUT_STAMP):
	 mkdir -p "$(BUILD_DIR)"
	 if [ ! -f "$(SOURCE_DIR)/configure.ac" ]; then \
	   rm -rf "$(SOURCE_DIR)"; \
	   svn export "$(VICE_SVN_URL)" "$(SOURCE_DIR)"; \
	 fi
	 touch "$@"

$(PATCH_STAMP): $(CHECKOUT_STAMP) $(PATCH_FILE)
	 if [ -f "$@" ]; then \
	   rm -rf "$(SOURCE_DIR)"; \
	   svn export "$(VICE_SVN_URL)" "$(SOURCE_DIR)"; \
	   touch "$(CHECKOUT_STAMP)"; \
	 fi
	 cd "$(SOURCE_DIR)" && patch -p1 --forward < "$(PATCH_FILE)"
	 touch "$@"
	 rm -f "$(CONFIGURE_STAMP)" "$(INSTALL_STAMP)"

$(CONFIGURE_STAMP): $(PATCH_STAMP) Makefile
	 cd "$(SOURCE_DIR)" && ./autogen.sh
	 cd "$(SOURCE_DIR)" && ./configure --prefix="$(PREFIX_DIR)" $(VICE_CONFIGURE_FLAGS)
	 touch "$@"

$(INSTALL_STAMP): $(CONFIGURE_STAMP) Makefile
	 $(MAKE) -C "$(SOURCE_DIR)" -j"$(JOBS)"
	 rm -rf "$(PREFIX_DIR)"
	 $(MAKE) -C "$(SOURCE_DIR)" install
	 touch "$@"

$(PACKAGE_STAMP): $(INSTALL_STAMP) Makefile
	 rm -rf "$(APP_DIR)"
	 mkdir -p "$(APP_RESOURCES_DIR)" "$(APP_MACOS_DIR)"
	 cp -R "$(PREFIX_DIR)/bin" "$(APP_RESOURCES_DIR)/"
	 cp -R "$(PREFIX_DIR)/share" "$(APP_RESOURCES_DIR)/"
	 if [ -d "$(PREFIX_DIR)/lib" ]; then cp -R "$(PREFIX_DIR)/lib" "$(APP_RESOURCES_DIR)/"; fi
	 printf '%s\n' \
	   '<?xml version="1.0" encoding="UTF-8"?>' \
	   '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">' \
	   '<plist version="1.0">' \
	   '<dict>' \
	   '  <key>CFBundleExecutable</key>' \
	   '  <string>VICE</string>' \
	   '  <key>CFBundleIdentifier</key>' \
	   '  <string>net.resheim.commodore-commander.patched-vice</string>' \
	   '  <key>CFBundleName</key>' \
	   '  <string>Commodore Commander Patched VICE</string>' \
	   '  <key>CFBundlePackageType</key>' \
	   '  <string>APPL</string>' \
	   '  <key>CFBundleShortVersionString</key>' \
	   '  <string>$(VICE_VERSION)</string>' \
	   '  <key>CFBundleVersion</key>' \
	   '  <string>$(VICE_VERSION)</string>' \
	   '</dict>' \
	   '</plist>' \
	   > "$(APP_CONTENTS_DIR)/Info.plist"
	 printf '%s\n' \
	   '#!/bin/sh' \
	   'resources_dir="$$(CDPATH= cd -- "$$(dirname -- "$$0")/../Resources" && pwd)"' \
	   'exec "$$resources_dir/bin/x64sc" "$$@"' \
	   > "$(APP_MACOS_DIR)/VICE"
	 chmod +x "$(APP_MACOS_DIR)/VICE"
	 touch "$@"

bundle-dylibs: $(PACKAGE_STAMP)
	 if command -v otool >/dev/null 2>&1 && command -v install_name_tool >/dev/null 2>&1; then \
	   mkdir -p "$(APP_RESOURCES_DIR)/lib"; \
	   for pass in 1 2 3 4; do \
	     find "$(APP_RESOURCES_DIR)/bin" "$(APP_RESOURCES_DIR)/lib" -type f 2>/dev/null | while IFS= read -r file; do \
	       otool -L "$$file" 2>/dev/null | awk 'NR > 1 { print $$1 }' | grep -E '^(/opt/homebrew|/usr/local|$(PREFIX_DIR))/' | while IFS= read -r dependency; do \
	         dependency_name="$$(basename "$$dependency")"; \
	         if [ ! -f "$(APP_RESOURCES_DIR)/lib/$$dependency_name" ]; then \
	           cp "$$dependency" "$(APP_RESOURCES_DIR)/lib/$$dependency_name"; \
	           chmod u+w "$(APP_RESOURCES_DIR)/lib/$$dependency_name"; \
	         fi; \
	       done; \
	     done; \
	   done; \
	   find "$(APP_RESOURCES_DIR)/lib" -name '*.dylib' -type f | while IFS= read -r dylib; do \
	     install_name_tool -id "@executable_path/../lib/$$(basename "$$dylib")" "$$dylib" 2>/dev/null || true; \
	   done; \
	   find "$(APP_RESOURCES_DIR)/bin" "$(APP_RESOURCES_DIR)/lib" -type f 2>/dev/null | while IFS= read -r file; do \
	     chmod u+w "$$file" 2>/dev/null || true; \
	     otool -L "$$file" 2>/dev/null | awk 'NR > 1 { print $$1 }' | grep -E '^(/opt/homebrew|/usr/local|$(PREFIX_DIR))/' | while IFS= read -r dependency; do \
	       install_name_tool -change "$$dependency" "@executable_path/../lib/$$(basename "$$dependency")" "$$file" 2>/dev/null || true; \
	     done; \
	   done; \
	 else \
	   echo "Skipping dylib bundling; otool/install_name_tool not available."; \
	 fi

sign: $(PACKAGE_STAMP)
	 if command -v codesign >/dev/null 2>&1; then \
	   xattr -cr "$(APP_DIR)" 2>/dev/null || true; \
	   find "$(APP_RESOURCES_DIR)/bin" "$(APP_RESOURCES_DIR)/lib" -type f 2>/dev/null | while IFS= read -r file; do \
	     codesign --force --sign "$(VICE_CODESIGN_IDENTITY)" "$$file" >/dev/null 2>&1 || true; \
	   done; \
	   codesign --force --deep --sign "$(VICE_CODESIGN_IDENTITY)" "$(APP_DIR)"; \
	   codesign --verify --deep --strict --verbose=2 "$(APP_DIR)"; \
	 fi

verify: $(PACKAGE_STAMP)
	 test -f "$(APP_CONTENTS_DIR)/Info.plist"
	 test -x "$(APP_RESOURCES_DIR)/bin/x64sc"
	 test -d "$(APP_RESOURCES_DIR)/share/vice"
	 test -f "$(APP_RESOURCES_DIR)/share/vice/C64/basic-901226-01.bin"
	 test -f "$(APP_RESOURCES_DIR)/share/vice/C64/kernal-901227-03.bin"
	 if command -v strings >/dev/null 2>&1; then strings "$(APP_RESOURCES_DIR)/bin/x64sc" | grep -q -- "-cc-embed"; fi
	 @echo "Patched VICE package is ready: $(APP_DIR)"

check-platform:
	 test "$(PLATFORM)" = "darwin-arm64" || { echo "Only PLATFORM=darwin-arm64 is packaged as VICE.app in this Makefile."; exit 1; }

check-prereqs:
	 command -v svn >/dev/null 2>&1 || { echo "svn is required to export VICE source."; exit 1; }
	 command -v patch >/dev/null 2>&1 || { echo "patch is required to apply $(PATCH_FILE)."; exit 1; }
	 command -v make >/dev/null 2>&1 || { echo "make is required to build VICE."; exit 1; }
	 command -v dos2unix >/dev/null 2>&1 || { echo "dos2unix is required to configure VICE."; exit 1; }
	 command -v pkg-config >/dev/null 2>&1 || { echo "pkg-config is required to find SDL2 dependencies."; exit 1; }
	 pkg-config --exists sdl2 || { echo "SDL2 development files are required. Install sdl2 or sdl2-compat."; exit 1; }
	 pkg-config --exists SDL2_image || { echo "SDL2_image development files are required. On Homebrew, run: brew install sdl2_image"; exit 1; }

clean:
	 rm -rf "$(BUILD_DIR)" "$(DIST_ROOT)"

distclean: clean
