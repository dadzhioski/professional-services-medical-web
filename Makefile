.PHONY: image image-smoke-test container-scan security-check
image:
	node scripts/image.mjs build
image-smoke-test:
	node scripts/image.mjs smoke
container-scan:
	node scripts/security.mjs container
security-check:
	node scripts/security.mjs secrets
	npm audit --audit-level=high
