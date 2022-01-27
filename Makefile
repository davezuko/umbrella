MICROBUNDLE_FLAGS=\
--format modern,cjs \
--no-compress \
--no-sourcemap \
--external react,esbuild,express,compression

default: packages test

.PHONY: packages
packages:
	$(MAKE) package dir=adal
	$(MAKE) package dir=esbuild-plugin-preact
	$(MAKE) package dir=observable
	$(MAKE) package dir=smite
	$(MAKE) package dir=testing

package:
	rm -rf packages/$(dir)/dist
	yarn microbundle build --cwd packages/$(dir) $(MICROBUNDLE_FLAGS)

publish:
	$(MAKE) package dir=$(dir)
	npm publish ./packages/$(dir) --access public

publish-dry:
	$(MAKE) package dir=$(dir)
	npm publish ./packages/$(dir) --access public --dry-run

.PHONY: test
test:
	yarn test

format:
	yarn prettier . --write