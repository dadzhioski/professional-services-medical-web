.PHONY: image image-smoke-test container-scan security-check
image:
	node scripts/image.mjs build
image-smoke-test:
	node scripts/image.mjs smoke
container-scan:
	node scripts/security.mjs container
security-check:
	node scripts/security.mjs secrets
	npm run security:dependencies

.PHONY: validate-production-config edge-network integration-up integration-routing-test integration-api-unavailable-test integration-upload-test integration-restart-test integration-down integration-test integration-browser-test
validate-production-config:
	node scripts/integration.mjs validate
edge-network:
	node scripts/integration.mjs edge-network
integration-up:
	node scripts/integration.mjs up
integration-routing-test:
	node scripts/integration.mjs routing
integration-api-unavailable-test:
	node scripts/integration.mjs unavailable
integration-upload-test:
	node scripts/integration.mjs uploads
integration-restart-test:
	node scripts/integration.mjs restart
integration-down:
	node scripts/integration.mjs down
integration-test:
	node scripts/integration.mjs all
integration-browser-test:
	npx --no-install playwright test --config playwright.integration.config.ts
.PHONY: integration-compatibility-test
integration-compatibility-test:
	node scripts/compatibility.mjs
.PHONY: edge-container-scan
edge-container-scan:
	node scripts/security.mjs edge-container
.PHONY: edge-image
edge-image:
	node scripts/edge-image.mjs

.PHONY: validate-workflows
validate-workflows:
	node scripts/security.mjs workflows
