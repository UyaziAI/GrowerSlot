# Known Issues and Technical Debt

## Critical Issues

### DayPill Transform Scaling Clipping ✅ RESOLVED
- **Issue**: Selected day pills using `transform: scale()` get clipped by container boundaries
- **Impact**: Poor user experience with partially visible selection states
- **Root Cause**: Container height insufficient for scaled pill dimensions + ring effects
- **Status**: ✅ RESOLVED - Converted to layout-based sizing with proper container heights

### Container Overflow Handling ✅ RESOLVED
- **Issue**: Inconsistent `overflow-y` settings across component hierarchy causing clipping
- **Impact**: Pills cut off at top/bottom margins
- **Root Cause**: Mixed overflow settings between Card, CardContent, and Timeline containers
- **Status**: ✅ RESOLVED - All containers now use overflow-y-visible with symmetric padding

## Minor Issues

### API Versioning Inconsistency
- **Issue**: Mixed `/api/` and `/v1/` endpoint patterns
- **Impact**: Future API evolution complexity
- **Status**: 📋 Backlog

### CSV Export Missing
- **Issue**: Blueprint specifies CSV export but not implemented
- **Impact**: Limited data portability for users
- **Status**: 📋 Backlog

## Technical Debt

### Legacy Node.js Backend
- **Debt**: Maintaining dual FastAPI + Express backends
- **Impact**: Code duplication and testing complexity
- **Resolution**: Migrate remaining Express endpoints to FastAPI

### Component Coupling
- **Debt**: Calendar components tightly coupled to booking logic
- **Impact**: Difficult to reuse components in other contexts
- **Resolution**: Extract generic calendar components to shared library