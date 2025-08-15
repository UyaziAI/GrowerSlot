#!/usr/bin/env node
import { readFile, writeFile, pathExists, ensureDir } from 'fs-extra';
import * as path from 'path';
import { globby } from 'globby';

interface AuditResult {
  timestamp: string;
  router: {
    adminRouteFile: string | null;
    adminComponent: string | null;
    allAdminRoutes: Array<{
      file: string;
      line: string;
      component: string;
    }>;
  };
  header: {
    hasNewStructure: boolean;
    hasLegacyButtons: boolean;
    foundLabels: string[];
    legacyLabels: string[];
    createMoreButtons: boolean;
  };
  dayInteractions: {
    dayPeekSheet: { imported: boolean; used: boolean };
    dayEditorSheet: { imported: boolean; used: boolean };
    bulkBar: { imported: boolean; used: boolean };
    slotSheet: { imported: boolean; used: boolean };
    filterDrawer: { imported: boolean; used: boolean };
  };
  createFlows: {
    separateDialogs: boolean;
    dateValidation: boolean;
    errorHandling: boolean;
  };
  dataFabrication: {
    placeholderData: Array<{ file: string; line: number }>;
    initialData: Array<{ file: string; line: number }>;
    fabricatedSlots: Array<{ file: string; line: number }>;
  };
  featureFlags: {
    adminTemplates: string | null;
    nextAvailable: string | null;
    envExampleExists: boolean;
  };
  legacy: {
    adminFiles: Array<{ file: string; imported: boolean; firstLine: string }>;
    apiRoutes: Array<{ file: string; line: number; route: string }>;
    oldQueryFlags: Array<{ file: string; line: number; flag: string }>;
  };
}

class AdminUIAuditor {
  private projectRoot: string;
  private result: AuditResult;

  constructor(projectRoot: string = process.cwd()) {
    this.projectRoot = projectRoot;
    this.result = {
      timestamp: new Date().toISOString(),
      router: {
        adminRouteFile: null,
        adminComponent: null,
        allAdminRoutes: [],
      },
      header: {
        hasNewStructure: false,
        hasLegacyButtons: false,
        foundLabels: [],
        legacyLabels: [],
        createMoreButtons: false,
      },
      dayInteractions: {
        dayPeekSheet: { imported: false, used: false },
        dayEditorSheet: { imported: false, used: false },
        bulkBar: { imported: false, used: false },
        slotSheet: { imported: false, used: false },
        filterDrawer: { imported: false, used: false },
      },
      createFlows: {
        separateDialogs: false,
        dateValidation: false,
        errorHandling: false,
      },
      dataFabrication: {
        placeholderData: [],
        initialData: [],
        fabricatedSlots: [],
      },
      featureFlags: {
        adminTemplates: null,
        nextAvailable: null,
        envExampleExists: false,
      },
      legacy: {
        adminFiles: [],
        apiRoutes: [],
        oldQueryFlags: [],
      },
    };
  }

  async audit(): Promise<AuditResult> {
    console.log('🔍 Starting Admin UI Audit...');
    
    await this.auditRouter();
    await this.auditHeader();
    await this.auditDayInteractions();
    await this.auditCreateFlows();
    await this.auditDataFabrication();
    await this.auditFeatureFlags();
    await this.auditLegacyComponents();

    console.log('✅ Audit complete');
    return this.result;
  }

  private async auditRouter(): Promise<void> {
    console.log('📍 Auditing router configuration...');
    
    const routerFiles = await globby([
      'app/frontend/src/**/*.{ts,tsx}',
      'client/src/**/*.{ts,tsx}',
    ], { cwd: this.projectRoot });

    for (const file of routerFiles) {
      const filePath = path.join(this.projectRoot, file);
      if (!await fs.pathExists(filePath)) continue;
      
      const content = await fs.readFile(filePath, 'utf-8');
      
      // Look for Route definitions
      const routeMatches = content.matchAll(/<Route[^>]*path=["']([^"']*admin[^"']*)["'][^>]*component=\{?([^}>\s]+)\}?[^>]*\/?>/gi);
      for (const match of routeMatches) {
        const [, routePath, component] = match;
        this.result.router.allAdminRoutes.push({
          file: file,
          line: match[0],
          component: component,
        });

        if (routePath === '/admin') {
          this.result.router.adminRouteFile = file;
          this.result.router.adminComponent = component;
        }
      }

      // Look for Switch/Route patterns
      const switchMatches = content.matchAll(/Route[^>]*path=["']\/admin["'][^>]*component=\{?([^}>\s]+)\}?/gi);
      for (const match of switchMatches) {
        const component = match[1];
        if (!this.result.router.adminComponent) {
          this.result.router.adminRouteFile = file;
          this.result.router.adminComponent = component;
        }
      }
    }
  }

  private async auditHeader(): Promise<void> {
    console.log('🎯 Auditing header implementation...');
    
    if (!this.result.router.adminComponent) return;

    // Find the admin component file
    const adminFiles = await globby([
      `**/*${this.result.router.adminComponent}.tsx`,
      `**/*${this.result.router.adminComponent}.jsx`,
      `**/pages/${this.result.router.adminComponent}.tsx`,
      `**/pages/AdminPage.tsx`,
    ], { cwd: this.projectRoot });

    for (const file of adminFiles) {
      const filePath = path.join(this.projectRoot, file);
      if (!await fs.pathExists(filePath)) continue;
      
      const content = await fs.readFile(filePath, 'utf-8');

      // Check for legacy button labels
      const legacyLabels = ['Blackout', 'Apply Restrictions', 'Create Slots', 'Bulk Create', 'Export CSV', 'Apply Template'];
      const foundLegacy = legacyLabels.filter(label => content.includes(label));
      
      this.result.header.legacyLabels = foundLegacy;
      this.result.header.hasLegacyButtons = foundLegacy.length > 0;

      // Check for new structure
      const hasCreate = content.includes('Create') && content.includes('ChevronDown');
      const hasMore = content.includes('More') && content.includes('ChevronDown');
      this.result.header.createMoreButtons = hasCreate && hasMore;
      this.result.header.hasNewStructure = hasCreate && hasMore && foundLegacy.length === 0;

      // Extract all button-like labels
      const labelMatches = content.matchAll(/(?:Button|MenuItem)[^>]*>[\s\n]*([^<]+)[\s\n]*</gi);
      for (const match of labelMatches) {
        const label = match[1].trim();
        if (label && label.length > 0 && label.length < 50) {
          this.result.header.foundLabels.push(label);
        }
      }
    }
  }

  private async auditDayInteractions(): Promise<void> {
    console.log('📅 Auditing day interaction components...');
    
    const componentFiles = await globby([
      'app/frontend/src/**/*.{ts,tsx}',
      'client/src/**/*.{ts,tsx}',
    ], { cwd: this.projectRoot });

    const components = ['DayPeekSheet', 'DayEditorSheet', 'BulkBar', 'SlotSheet', 'FilterDrawer'];

    for (const file of componentFiles) {
      const filePath = path.join(this.projectRoot, file);
      if (!await fs.pathExists(filePath)) continue;
      
      const content = await fs.readFile(filePath, 'utf-8');

      for (const component of components) {
        const key = component.charAt(0).toLowerCase() + component.slice(1) as keyof typeof this.result.dayInteractions;
        
        // Check import
        if (content.includes(`import`) && content.includes(component)) {
          this.result.dayInteractions[key].imported = true;
        }

        // Check usage in JSX
        if (content.includes(`<${component}`)) {
          this.result.dayInteractions[key].used = true;
        }
      }
    }
  }

  private async auditCreateFlows(): Promise<void> {
    console.log('🔨 Auditing create flows and guardrails...');
    
    const files = await globby([
      'app/frontend/src/**/*.{ts,tsx}',
      'client/src/**/*.{ts,tsx}',
    ], { cwd: this.projectRoot });

    let hasCreateSlotsDialog = false;
    let hasBulkCreateDialog = false;
    let hasDateValidation = false;
    let hasErrorHandling = false;

    for (const file of files) {
      const filePath = path.join(this.projectRoot, file);
      if (!await fs.pathExists(filePath)) continue;
      
      const content = await fs.readFile(filePath, 'utf-8');

      // Check for separate dialogs
      if (content.includes('CreateSlotsDialog')) hasCreateSlotsDialog = true;
      if (content.includes('BulkCreateDialog')) hasBulkCreateDialog = true;

      // Check for date validation
      if (content.includes('min=') || content.includes('min:') || content.includes('minDate')) {
        hasDateValidation = true;
      }

      // Check for error handling
      if (content.includes('json.error') || content.includes('error.message') || content.includes('errorData.error')) {
        hasErrorHandling = true;
      }
    }

    this.result.createFlows.separateDialogs = hasCreateSlotsDialog && hasBulkCreateDialog;
    this.result.createFlows.dateValidation = hasDateValidation;
    this.result.createFlows.errorHandling = hasErrorHandling;
  }

  private async auditDataFabrication(): Promise<void> {
    console.log('🔍 Auditing data fabrication patterns...');
    
    const files = await globby([
      'app/frontend/src/**/*.{ts,tsx}',
      'client/src/**/*.{ts,tsx}',
    ], { cwd: this.projectRoot });

    for (const file of files) {
      const filePath = path.join(this.projectRoot, file);
      if (!await fs.pathExists(filePath)) continue;
      
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n');

      lines.forEach((line, index) => {
        if (line.includes('placeholderData')) {
          this.result.dataFabrication.placeholderData.push({ file, line: index + 1 });
        }
        if (line.includes('initialData')) {
          this.result.dataFabrication.initialData.push({ file, line: index + 1 });
        }
        if (line.includes('fabricated') || line.includes('mock') && line.includes('slot')) {
          this.result.dataFabrication.fabricatedSlots.push({ file, line: index + 1 });
        }
      });
    }
  }

  private async auditFeatureFlags(): Promise<void> {
    console.log('🚩 Auditing feature flags...');
    
    const envPath = path.join(this.projectRoot, '.env.example');
    this.result.featureFlags.envExampleExists = await fs.pathExists(envPath);

    if (this.result.featureFlags.envExampleExists) {
      const envContent = await fs.readFile(envPath, 'utf-8');
      
      const templatesMatch = envContent.match(/VITE_FEATURE_ADMIN_TEMPLATES=(.+)/);
      if (templatesMatch) {
        this.result.featureFlags.adminTemplates = templatesMatch[1].trim();
      }

      const nextAvailableMatch = envContent.match(/VITE_FEATURE_NEXT_AVAILABLE=(.+)/);
      if (nextAvailableMatch) {
        this.result.featureFlags.nextAvailable = nextAvailableMatch[1].trim();
      }
    }
  }

  private async auditLegacyComponents(): Promise<void> {
    console.log('🗂️ Auditing legacy components...');
    
    // Find Admin-related files
    const adminFiles = await globby([
      '**/Admin*.{ts,tsx,js,jsx}',
      '**/*admin*.{ts,tsx,js,jsx}',
      '**/admin-*.{ts,tsx,js,jsx}',
    ], { 
      cwd: this.projectRoot,
      ignore: ['**/node_modules/**', '**/dist/**', '**/build/**']
    });

    for (const file of adminFiles) {
      const filePath = path.join(this.projectRoot, file);
      if (!await fs.pathExists(filePath)) continue;
      
      const content = await fs.readFile(filePath, 'utf-8');
      const firstLine = content.split('\n')[0] || '';
      
      // Check if this file is imported anywhere
      const allFiles = await globby(['**/*.{ts,tsx,js,jsx}'], { 
        cwd: this.projectRoot,
        ignore: ['**/node_modules/**', '**/dist/**', '**/build/**']
      });
      
      let imported = false;
      const basename = path.basename(file, path.extname(file));
      
      for (const otherFile of allFiles) {
        if (otherFile === file) continue;
        
        const otherFilePath = path.join(this.projectRoot, otherFile);
        const otherContent = await fs.readFile(otherFilePath, 'utf-8');
        
        if (otherContent.includes(`from '${file}'`) || 
            otherContent.includes(`from "./${basename}"`) ||
            otherContent.includes(`import ${basename}`) ||
            otherContent.includes(`import { ${basename}`)) {
          imported = true;
          break;
        }
      }

      this.result.legacy.adminFiles.push({
        file,
        imported,
        firstLine,
      });
    }

    // Find /api/ routes (non-v1)
    const allFiles = await globby(['**/*.{ts,tsx,js,jsx}'], { 
      cwd: this.projectRoot,
      ignore: ['**/node_modules/**', '**/dist/**', '**/build/**']
    });

    for (const file of allFiles) {
      const filePath = path.join(this.projectRoot, file);
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n');

      lines.forEach((line, index) => {
        const apiMatches = line.matchAll(/['"`](\/api\/[^'"`]+)['"`]/g);
        for (const match of apiMatches) {
          const route = match[1];
          if (!route.startsWith('/api/v1/')) {
            this.result.legacy.apiRoutes.push({ file, line: index + 1, route });
          }
        }
      });
    }

    // Find old React Query flags
    for (const file of allFiles) {
      const filePath = path.join(this.projectRoot, file);
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n');

      lines.forEach((line, index) => {
        if (line.includes('keepPreviousData')) {
          this.result.legacy.oldQueryFlags.push({ file, line: index + 1, flag: 'keepPreviousData' });
        }
      });
    }
  }

  async generateReports(): Promise<void> {
    console.log('📝 Generating reports...');
    
    const reportsDir = path.join(this.projectRoot, 'reports');
    await fs.ensureDir(reportsDir);

    // Generate JSON report
    await fs.writeFile(
      path.join(reportsDir, 'admin_ui_audit.json'),
      JSON.stringify(this.result, null, 2)
    );

    // Generate Markdown report
    const markdown = this.generateMarkdownReport();
    await fs.writeFile(
      path.join(reportsDir, 'admin_ui_audit.md'),
      markdown
    );

    console.log('📊 Reports saved to reports/ directory');
  }

  private generateMarkdownReport(): string {
    const r = this.result;
    
    const pass = (condition: boolean) => condition ? '✅ PASS' : '❌ FAIL';
    
    return `# Admin UI Audit Report

Generated: ${r.timestamp}

## Summary

| Component | Status | Notes |
|-----------|--------|-------|
| Router Wiring | ${pass(!!r.router.adminComponent)} | ${r.router.adminComponent ? `Uses ${r.router.adminComponent}` : 'No /admin route found'} |
| Header Implementation | ${pass(r.header.hasNewStructure)} | ${r.header.createMoreButtons ? 'Has Create ▾ and More ▾' : 'Missing new structure'} |
| Day Interactions | ${pass(r.dayInteractions.dayPeekSheet.used)} | DayPeekSheet: ${r.dayInteractions.dayPeekSheet.used ? 'Used' : 'Not used'} |
| Create Flows | ${pass(r.createFlows.separateDialogs)} | ${r.createFlows.separateDialogs ? 'Separate dialogs found' : 'Missing separate dialogs'} |
| Data Integrity | ${pass(r.dataFabrication.placeholderData.length === 0)} | ${r.dataFabrication.placeholderData.length} fabrication issues |
| Feature Flags | ${pass(r.featureFlags.envExampleExists)} | ${r.featureFlags.envExampleExists ? 'Env example exists' : 'Missing env example'} |
| Legacy Cleanup | ${pass(r.legacy.adminFiles.filter(f => f.imported).length === 0)} | ${r.legacy.adminFiles.filter(f => f.imported).length} legacy files imported |

## Router Configuration

**Admin Route File:** ${r.router.adminRouteFile || 'Not found'}
**Admin Component:** ${r.router.adminComponent || 'Not found'}

### All Admin Routes:
${r.router.allAdminRoutes.map(route => `- ${route.file}: ${route.component}`).join('\n') || 'None found'}

## Header Implementation

**New Structure:** ${r.header.hasNewStructure ? 'Yes' : 'No'}
**Legacy Buttons:** ${r.header.hasLegacyButtons ? 'Found' : 'None'}
**Create/More Dropdowns:** ${r.header.createMoreButtons ? 'Present' : 'Missing'}

### Legacy Labels Found:
${r.header.legacyLabels.map(label => `- ${label}`).join('\n') || 'None'}

### All Labels Found:
${r.header.foundLabels.slice(0, 10).map(label => `- "${label}"`).join('\n')}
${r.header.foundLabels.length > 10 ? `... and ${r.header.foundLabels.length - 10} more` : ''}

## Day Interactions

| Component | Imported | Used |
|-----------|----------|------|
| DayPeekSheet | ${r.dayInteractions.dayPeekSheet.imported ? '✅' : '❌'} | ${r.dayInteractions.dayPeekSheet.used ? '✅' : '❌'} |
| DayEditorSheet | ${r.dayInteractions.dayEditorSheet.imported ? '✅' : '❌'} | ${r.dayInteractions.dayEditorSheet.used ? '✅' : '❌'} |
| BulkBar | ${r.dayInteractions.bulkBar.imported ? '✅' : '❌'} | ${r.dayInteractions.bulkBar.used ? '✅' : '❌'} |
| SlotSheet | ${r.dayInteractions.slotSheet.imported ? '✅' : '❌'} | ${r.dayInteractions.slotSheet.used ? '✅' : '❌'} |
| FilterDrawer | ${r.dayInteractions.filterDrawer.imported ? '✅' : '❌'} | ${r.dayInteractions.filterDrawer.used ? '✅' : '❌'} |

## Create Flows & Guardrails

- **Separate Dialogs:** ${r.createFlows.separateDialogs ? '✅' : '❌'}
- **Date Validation:** ${r.createFlows.dateValidation ? '✅' : '❌'}
- **Error Handling:** ${r.createFlows.errorHandling ? '✅' : '❌'}

## Data Fabrication Issues

### Placeholder Data:
${r.dataFabrication.placeholderData.map(item => `- ${item.file}:${item.line}`).join('\n') || 'None found'}

### Initial Data:
${r.dataFabrication.initialData.map(item => `- ${item.file}:${item.line}`).join('\n') || 'None found'}

### Fabricated Slots:
${r.dataFabrication.fabricatedSlots.map(item => `- ${item.file}:${item.line}`).join('\n') || 'None found'}

## Feature Flags

- **VITE_FEATURE_ADMIN_TEMPLATES:** ${r.featureFlags.adminTemplates || 'Not set'}
- **VITE_FEATURE_NEXT_AVAILABLE:** ${r.featureFlags.nextAvailable || 'Not set'}
- **.env.example exists:** ${r.featureFlags.envExampleExists ? 'Yes' : 'No'}

## Legacy Components

### Admin Files:
${r.legacy.adminFiles.map(file => `- ${file.file} ${file.imported ? '(IMPORTED ⚠️)' : '(unused)'}\n  \`${file.firstLine}\``).join('\n') || 'None found'}

### Non-v1 API Routes:
${r.legacy.apiRoutes.map(item => `- ${item.file}:${item.line} → ${item.route}`).join('\n') || 'None found'}

### Old Query Flags:
${r.legacy.oldQueryFlags.map(item => `- ${item.file}:${item.line} → ${item.flag}`).join('\n') || 'None found'}

## Recommendations

${this.generateRecommendations()}

---
*Report generated by Admin UI Auditor*
`;
  }

  private generateRecommendations(): string {
    const r = this.result;
    const recommendations: string[] = [];

    if (!r.router.adminComponent) {
      recommendations.push('❗ **Critical:** No /admin route found. Add route configuration.');
    }

    if (r.header.hasLegacyButtons) {
      recommendations.push('🔧 **Header:** Remove legacy buttons and implement Create ▾ / More ▾ dropdowns.');
    }

    if (!r.dayInteractions.dayPeekSheet.used) {
      recommendations.push('📅 **UX:** Implement DayPeekSheet for day interactions.');
    }

    if (!r.createFlows.separateDialogs) {
      recommendations.push('🏗️ **Create Flows:** Split create functionality into separate dialogs.');
    }

    if (r.dataFabrication.placeholderData.length > 0) {
      recommendations.push('🎯 **Data Integrity:** Remove placeholder data usage in favor of real API calls.');
    }

    const importedLegacy = r.legacy.adminFiles.filter(f => f.imported);
    if (importedLegacy.length > 0) {
      recommendations.push(`🗂️ **Legacy Cleanup:** Remove ${importedLegacy.length} imported legacy Admin files.`);
    }

    if (r.legacy.apiRoutes.length > 0) {
      recommendations.push(`🔗 **API Migration:** Update ${r.legacy.apiRoutes.length} non-v1 API routes.`);
    }

    return recommendations.join('\n\n') || '✅ No major issues detected.';
  }
}

// Main execution
async function main() {
  try {
    const auditor = new AdminUIAuditor();
    const result = await auditor.audit();
    await auditor.generateReports();
    
    console.log('\n🎉 Audit completed successfully!');
    console.log('📁 Check reports/admin_ui_audit.md and reports/admin_ui_audit.json');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Audit failed:', error);
    process.exit(1);
  }
}

// Execute if run directly
main();

export default AdminUIAuditor;