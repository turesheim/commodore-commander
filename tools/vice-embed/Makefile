SHELL := /bin/sh
.DEFAULT_GOAL := package

VICE_VERSION := 3.10.0
VICE_TAG := v3.10
VICE_SVN_URL := https://svn.code.sf.net/p/vice-emu/code/tags/$(VICE_TAG)/vice
PATCH_FILE := $(CURDIR)/vice-$(VICE_VERSION)-commodore-embed.patch

PLATFORM ?= $(shell node -p "process.platform + '-' + process.arch")
BUILD_DIR ?= $(CURDIR)/build/$(PLATFORM)
SOURCE_DIR ?= $(BUILD_DIR)/vice-$(VICE_VERSION)
PREFIX_DIR ?= $(BUILD_DIR)/prefix
DIST_ROOT ?= $(CURDIR)/dist
JOBS ?= $(shell sysctl -n hw.ncpu 2>/dev/null || nproc 2>/dev/null || echo 4)
ifeq ($(PLATFORM),win32-x64)
VICE_CONFIGURE_FLAGS ?= --enable-sdl2ui --disable-pdf-docs --disable-html-docs --disable-arch
else
VICE_CONFIGURE_FLAGS ?= --enable-sdl2ui
endif
VICE_CODESIGN_IDENTITY ?= -

REPO_ROOT := $(abspath $(CURDIR)/../..)
CHECKOUT_STAMP := $(BUILD_DIR)/.checkout-$(VICE_TAG)
PATCH_STAMP := $(BUILD_DIR)/.patched-$(VICE_VERSION)
CONFIGURE_STAMP := $(BUILD_DIR)/.configured-$(VICE_VERSION)
INSTALL_STAMP := $(BUILD_DIR)/.installed-$(VICE_VERSION)

ifeq ($(PLATFORM),darwin-arm64)
APP_DIR := $(DIST_ROOT)/$(PLATFORM)/VICE.app
APP_CONTENTS_DIR := $(APP_DIR)/Contents
APP_RESOURCES_DIR := $(APP_CONTENTS_DIR)/Resources
APP_MACOS_DIR := $(APP_CONTENTS_DIR)/MacOS
ASSETS_APP_DIR := $(REPO_ROOT)/packages/theia-extension/assets/vice/$(PLATFORM)/VICE.app
else
APP_DIR := $(DIST_ROOT)/$(PLATFORM)
APP_RESOURCES_DIR := $(APP_DIR)
ASSETS_APP_DIR := $(REPO_ROOT)/packages/theia-extension/assets/vice/$(PLATFORM)
endif
PACKAGE_STAMP := $(APP_RESOURCES_DIR)/.commodore-commander-patched-vice
VICE_EXE := x64sc
ifeq ($(PLATFORM),win32-x64)
VICE_EXE := x64sc.exe
endif
STAGE_STAMP := $(APP_RESOURCES_DIR)/.commodore-commander-staged-vice

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

package: check-platform check-prereqs verify

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

stage: $(STAGE_STAMP)

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
ifeq ($(PLATFORM),win32-x64)
	 mkdir -p "$(PREFIX_DIR)/bin" "$(PREFIX_DIR)/share/vice"
	 cp "$(SOURCE_DIR)"/src/*.exe "$(SOURCE_DIR)/src/tools/cartconv/cartconv.exe" "$(SOURCE_DIR)/src/tools/petcat/petcat.exe" "$(PREFIX_DIR)/bin/"
	 cp -R "$(SOURCE_DIR)/data/". "$(PREFIX_DIR)/share/vice/"
	 find "$(PREFIX_DIR)/share/vice" -name 'Makefile*' -delete
	 cp "$(SOURCE_DIR)/COPYING" "$(SOURCE_DIR)/README" "$(PREFIX_DIR)/"
else
	 $(MAKE) -C "$(SOURCE_DIR)" install
endif
	 touch "$@"

$(STAGE_STAMP): $(INSTALL_STAMP) Makefile bundle-dylibs.mjs bundle-linux-libs.mjs bundle-windows-libs.mjs
	 rm -rf "$(APP_DIR)"
	 mkdir -p "$(APP_RESOURCES_DIR)"
	 cp -R "$(PREFIX_DIR)/bin" "$(APP_RESOURCES_DIR)/"
	 cp -R "$(PREFIX_DIR)/share" "$(APP_RESOURCES_DIR)/"
	 if [ -d "$(PREFIX_DIR)/lib" ]; then cp -R "$(PREFIX_DIR)/lib" "$(APP_RESOURCES_DIR)/"; fi
ifeq ($(PLATFORM),win32-x64)
	 cp "$(PREFIX_DIR)/COPYING" "$(PREFIX_DIR)/README" "$(APP_RESOURCES_DIR)/"
endif
ifeq ($(PLATFORM),darwin-arm64)
	 mkdir -p "$(APP_MACOS_DIR)"
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
endif
	 touch "$@"

bundle-dylibs: $(STAGE_STAMP)
ifeq ($(PLATFORM),darwin-arm64)
	node "$(CURDIR)/bundle-dylibs.mjs" "$(APP_RESOURCES_DIR)"
else ifeq ($(PLATFORM),win32-x64)
	node "$(CURDIR)/bundle-windows-libs.mjs" "$(APP_RESOURCES_DIR)" "$$(cygpath -w "$(MINGW_PREFIX)")"
else
	node "$(CURDIR)/bundle-linux-libs.mjs" "$(APP_RESOURCES_DIR)"
endif

sign: bundle-dylibs
ifeq ($(PLATFORM),darwin-arm64)
	 if command -v codesign >/dev/null 2>&1; then \
	   xattr -cr "$(APP_DIR)" 2>/dev/null || true; \
	   find "$(APP_RESOURCES_DIR)/bin" "$(APP_RESOURCES_DIR)/lib" -type f 2>/dev/null | while IFS= read -r file; do \
	     codesign --force --sign "$(VICE_CODESIGN_IDENTITY)" "$$file" >/dev/null 2>&1 || true; \
	   done; \
	   codesign --force --deep --sign "$(VICE_CODESIGN_IDENTITY)" "$(APP_DIR)"; \
	   codesign --verify --deep --strict --verbose=2 "$(APP_DIR)"; \
	 fi

endif

verify: sign
ifeq ($(PLATFORM),darwin-arm64)
	 test -f "$(APP_CONTENTS_DIR)/Info.plist"
endif
	 test -x "$(APP_RESOURCES_DIR)/bin/$(VICE_EXE)"
	 test -d "$(APP_RESOURCES_DIR)/share/vice"
	 test -f "$(APP_RESOURCES_DIR)/share/vice/C64/basic-901226-01.bin"
	 test -f "$(APP_RESOURCES_DIR)/share/vice/C64/kernal-901227-03.bin"
	 if command -v strings >/dev/null 2>&1; then strings "$(APP_RESOURCES_DIR)/bin/$(VICE_EXE)" | grep -q -- "-cc-embed"; fi
	 touch "$(PACKAGE_STAMP)"
	 @echo "Patched VICE package is ready: $(APP_DIR)"

check-platform:
	 case "$(PLATFORM)" in darwin-arm64|linux-x64|win32-x64) ;; *) echo "Unsupported patched VICE platform: $(PLATFORM)"; exit 1 ;; esac
	 test "$(PLATFORM)" = "$$(node -p "process.platform + '-' + process.arch")" || { echo "Build patched VICE on the target platform."; exit 1; }

check-prereqs:
ifeq ($(PLATFORM),win32-x64)
	 test "$(MSYSTEM)" = MINGW64 || { echo "Build Windows x64 VICE in the MSYS2 MINGW64 shell."; exit 1; }
	 command -v gcc >/dev/null 2>&1 || { echo "MinGW GCC is required."; exit 1; }
	 command -v objdump >/dev/null 2>&1 || { echo "MinGW objdump is required to bundle DLLs."; exit 1; }
endif
	 command -v node >/dev/null 2>&1 || { echo "Node.js is required to bundle VICE libraries."; exit 1; }
ifeq ($(PLATFORM),linux-x64)
	 command -v patchelf >/dev/null 2>&1 || { echo "patchelf is required to bundle Linux VICE libraries."; exit 1; }
endif
	 command -v svn >/dev/null 2>&1 || { echo "svn is required to export VICE source."; exit 1; }
	 command -v patch >/dev/null 2>&1 || { echo "patch is required to apply $(PATCH_FILE)."; exit 1; }
	 command -v make >/dev/null 2>&1 || { echo "make is required to build VICE."; exit 1; }
	 command -v dos2unix >/dev/null 2>&1 || { echo "dos2unix is required to configure VICE."; exit 1; }
	 command -v xa >/dev/null 2>&1 || { echo "xa is required to configure VICE."; exit 1; }
	 command -v pkg-config >/dev/null 2>&1 || { echo "pkg-config is required to find SDL2 dependencies."; exit 1; }
	 pkg-config --exists sdl2 || { echo "SDL2 development files are required. Install sdl2 or sdl2-compat."; exit 1; }
	 pkg-config --exists SDL2_image || { echo "SDL2_image development files are required. On Homebrew, run: brew install sdl2_image"; exit 1; }

clean:
	 rm -rf "$(BUILD_DIR)" "$(DIST_ROOT)"

distclean: clean
