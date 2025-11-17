# Documentation Index

Complete documentation for the Serverless WiFi Billing System.

## 📖 Quick Links

- [Main README](../README.md) - Project overview and quick start
- [Architecture Guide](#architecture-guide) - System design and components
- [Deployment Guide](#deployment-guide) - Setup and deployment
- [API Reference](#api-reference) - Complete API documentation
- [M-Pesa Integration](#m-pesa-integration) - Payment setup
- [Gateway Setup](#gateway-setup) - Hotspot configuration
- [Monitoring](#monitoring--operations) - Operations and monitoring
- [Testing](#testing-guide) - Testing strategies
- [Troubleshooting](#troubleshooting) - Common issues and solutions

---

## Architecture Guide

**File**: [ARCHITECTURE.md](ARCHITECTURE.md)

**Contents**:
- System architecture overview
- AWS services and components
- Data flow diagrams
- Network architecture
- Security architecture
- Scalability and performance
- High availability setup
- Cost optimization

**When to read**: Before deployment, for understanding system design

---

## Deployment Guide

**File**: [DEPLOYMENT.md](DEPLOYMENT.md)

**Contents**:
- Prerequisites and setup
- AWS SAM CLI installation
- Environment configuration
- Step-by-step deployment
- Production deployment checklist
- Rollback procedures

**When to read**: During initial setup and deployment

---

## API Reference

**File**: [API.md](API.md)

**Contents**:
- All API endpoints
- Request/response schemas
- Authentication methods
- Error codes
- Rate limiting
- Code examples (cURL, JavaScript)
- Postman collection

**When to read**: For frontend/integration development

---

## M-Pesa Integration

**File**: [MPESA_INTEGRATION.md](MPESA_INTEGRATION.md)

**Contents**:
- Daraja API setup
- STK Push implementation
- Callback handling
- Sandbox testing
- Production deployment
- Common issues and solutions

**When to read**: For payment integration setup

---

## Gateway Setup

**File**: [GATEWAY_SETUP.md](GATEWAY_SETUP.md)

**Contents**:
- Mikrotik configuration
- UniFi setup
- pfSense configuration
- Generic RADIUS setup
- Testing procedures
- Troubleshooting

**When to read**: For hotspot gateway configuration

---

## Monitoring & Operations

**File**: [MONITORING.md](MONITORING.md)

**Contents**:
- CloudWatch dashboards
- Metrics and KPIs
- Alarms and alerts
- Logging strategies
- Daily/weekly/monthly operations
- Incident response procedures

**When to read**: For system administration and operations

---

## Testing Guide

**File**: [TESTING.md](TESTING.md)

**Contents**:
- Unit testing
- Integration testing
- End-to-end testing
- M-Pesa sandbox testing
- Load testing
- Security testing
- CI/CD integration

**When to read**: For development and QA

---

## Troubleshooting

**File**: [TROUBLESHOOTING.md](TROUBLESHOOTING.md)

**Contents**:
- User connection issues
- Payment failures
- Gateway problems
- System errors
- Debugging tools
- Emergency procedures

**When to read**: When encountering issues or errors

---

## Architecture Images

**Folder**: [images/](images/)

Contains all architecture diagrams and visual documentation:
- System architecture overview
- Component diagrams
- Data flow visualizations
- Network topology

See [images/README.md](images/README.md) for image guidelines.

---

## Documentation Standards

### Markdown Formatting

- Use ATX-style headers (`#`, `##`, `###`)
- Include table of contents for long documents
- Use code fences with language identifiers
- Include examples and code snippets
- Add links between related documents

### Code Examples

Always include:
- Language identifier
- Comments explaining key steps
- Error handling
- Real-world use cases

### Diagrams

- Use Mermaid for simple diagrams
- Save complex diagrams as PNG in `images/`
- Include alt text for accessibility
- Keep diagrams up-to-date with code changes

### Updates

When updating code, also update:
1. Related documentation
2. API examples
3. Architecture diagrams
4. Troubleshooting sections

---

## Contributing to Documentation

### Adding New Documentation

1. Create file in `docs/` folder
2. Use clear, descriptive filename (kebab-case)
3. Add to this index
4. Link from main README if necessary
5. Include table of contents
6. Add code examples

### Documentation Checklist

- [ ] Clear title and purpose
- [ ] Table of contents (if > 3 sections)
- [ ] Step-by-step instructions
- [ ] Code examples with comments
- [ ] Error handling examples
- [ ] Links to related docs
- [ ] Updated index

### Review Process

Before committing documentation changes:
1. Spell check and grammar review
2. Test all code examples
3. Verify all links work
4. Check images display correctly
5. Ensure formatting is consistent

---

## Documentation Tools

### Recommended Editors

- **VS Code** with Markdown extensions
- **Typora** for WYSIWYG editing
- **MacDown** (macOS)
- **MarkText** (cross-platform)

### Helpful Extensions

- Markdown All in One
- Markdown Preview Enhanced
- Code Spell Checker
- Mermaid Preview

### Validation

```bash
# Check for broken links
npm install -g markdown-link-check
markdown-link-check docs/**/*.md

# Lint markdown
npm install -g markdownlint-cli
markdownlint docs/**/*.md
```

---

## Need Help?

- **General Questions**: Open a GitHub issue
- **Documentation Bugs**: Submit a PR
- **Support**: support@example.com

---

**Last Updated**: November 17, 2025  
**Version**: 1.0.0
