# Release Checklist - Feature Flag Rollout

## Feature Flags Overview

### Core Feature Flags
- `VITE_FEATURE_ADMIN_TEMPLATES` - Default: `false`
  - **Purpose**: Enable admin template system (create, apply, preview)
  - **Dependencies**: B8-B10 implementation
  - **Impact**: Admin dashboard template functionality

- `VITE_FEATURE_NEXT_AVAILABLE` - Default: `false`  
  - **Purpose**: Enable next available slot finder
  - **Dependencies**: B11-B12 implementation
  - **Impact**: Admin and grower next available search functionality

### Legacy Flags (Always On)
- `VITE_FEATURE_ADMIN_CALENDAR` - Default: `true` (MVP core)
- `VITE_FEATURE_CSV_EXPORT` - Default: `true` (B16 completed)
- `VITE_FEATURE_AUDIT_TRAIL` - Default: `true` (B17 completed)

## Staging Environment Rollout

### Phase 1: Development Testing
```bash
# Enable all flags for comprehensive testing
export VITE_FEATURE_ADMIN_TEMPLATES=true
export VITE_FEATURE_NEXT_AVAILABLE=true
```

**Verification Steps:**
1. Admin template creation and management
2. Apply template with idempotency checks
3. Next available search functionality
4. Cross-feature integration testing

### Phase 2: Staging Environment
```bash
# Gradual flag enablement
# Week 1: Templates only
export VITE_FEATURE_ADMIN_TEMPLATES=true
export VITE_FEATURE_NEXT_AVAILABLE=false

# Week 2: Both features  
export VITE_FEATURE_ADMIN_TEMPLATES=true
export VITE_FEATURE_NEXT_AVAILABLE=true
```

### Phase 3: Production Rollout
```bash
# Conservative production approach
# Month 1: Internal admin users only
export VITE_FEATURE_ADMIN_TEMPLATES=true
export VITE_FEATURE_NEXT_AVAILABLE=false

# Month 2: Full feature set
export VITE_FEATURE_ADMIN_TEMPLATES=true  
export VITE_FEATURE_NEXT_AVAILABLE=true
```

## Smoke Test Checklist

### Core Admin Calendar Flow
- [ ] **Bulk Create**: Generate slots for date range with proper capacity
- [ ] **Blackout Operations**: Toggle slot availability and verify restrictions
- [ ] **Drag & Drop**: Move bookings between slots with transaction safety
- [ ] **Month View**: Virtualized calendar performance with large date ranges
- [ ] **CSV Export**: Download booking data with proper filtering

### Template System (`VITE_FEATURE_ADMIN_TEMPLATES=true`)
- [ ] **Template Creation**: Create reusable slot patterns
- [ ] **Apply Template**: Execute template with idempotency protection
- [ ] **Template Preview**: Show changes before applying
- [ ] **Template Validation**: Handle conflicts and overlaps
- [ ] **Audit Trail**: Track template operations in audit log

### Next Available (`VITE_FEATURE_NEXT_AVAILABLE=true`)
- [ ] **Search Functionality**: Find next available slots by criteria
- [ ] **Restriction Compliance**: Respect grower/cultivar restrictions
- [ ] **Capacity Checking**: Honor available capacity limits
- [ ] **Jump Navigation**: Navigate directly to found slots
- [ ] **Admin Integration**: Search from admin calendar interface

### Cross-Feature Integration
- [ ] **Template + Next Available**: Templates consider existing availability
- [ ] **Restrictions + Templates**: Template application respects restrictions
- [ ] **Audit + All Features**: All operations logged correctly
- [ ] **Performance**: No degradation with all flags enabled

## Environment Configuration

### Development (.env.local)
```bash
# Full feature development
VITE_FEATURE_ADMIN_TEMPLATES=true
VITE_FEATURE_NEXT_AVAILABLE=true
VITE_FEATURE_ADMIN_CALENDAR=true
VITE_FEATURE_CSV_EXPORT=true
VITE_FEATURE_AUDIT_TRAIL=true
```

### Staging (.env.staging)
```bash
# Staged rollout configuration
VITE_FEATURE_ADMIN_TEMPLATES=false  # Enable after validation
VITE_FEATURE_NEXT_AVAILABLE=false   # Enable after templates
VITE_FEATURE_ADMIN_CALENDAR=true
VITE_FEATURE_CSV_EXPORT=true
VITE_FEATURE_AUDIT_TRAIL=true
```

### Production (.env.production)
```bash
# Conservative production defaults
VITE_FEATURE_ADMIN_TEMPLATES=false  # Manual enablement required
VITE_FEATURE_NEXT_AVAILABLE=false   # Manual enablement required  
VITE_FEATURE_ADMIN_CALENDAR=true
VITE_FEATURE_CSV_EXPORT=true
VITE_FEATURE_AUDIT_TRAIL=true
```

## Rollback Procedures

### Immediate Rollback (< 5 minutes)
```bash
# Disable problematic flags immediately
export VITE_FEATURE_ADMIN_TEMPLATES=false
export VITE_FEATURE_NEXT_AVAILABLE=false

# Restart application to apply changes
npm restart
```

### Application-Level Rollback
1. **Flag Toggle**: Set problematic flags to `false` in environment
2. **Cache Clear**: Clear browser cache and localStorage  
3. **Health Check**: Verify core functionality restored
4. **User Notification**: Inform users of temporary feature unavailability

### Code Rollback (if needed)
1. **Single PR Revert**: Identify and revert specific feature PR
2. **Database Safety**: All migrations are additive-only (no data loss)
3. **Feature Isolation**: Each feature flag controls independent functionality
4. **Regression Testing**: Run full test suite after rollback

### Database Considerations
- ✅ **Additive Only**: All migrations add tables/columns, never remove
- ✅ **Backward Compatible**: Old code continues working with new schema
- ✅ **Data Preservation**: Feature flags don't affect existing data
- ✅ **Rollback Safe**: Disabling flags doesn't break database integrity

## Monitoring & Alerts

### Key Metrics
- **Feature Usage**: Track template applications and next available searches
- **Error Rates**: Monitor feature-specific error rates
- **Performance**: API response times for new endpoints
- **User Adoption**: Feature flag usage analytics

### Alert Thresholds
- Error rate > 5% for template operations
- API response time > 2s for next available searches  
- Browser console errors related to feature flags
- Database query performance degradation

## Communication Plan

### Internal Team
- **Pre-Release**: Feature documentation and training
- **During Rollout**: Daily standup feature status updates
- **Post-Release**: Weekly usage analytics review

### External Users
- **Feature Announcements**: Gradual feature introduction emails
- **Documentation**: Updated user guides for new features
- **Support**: Feature-specific support documentation

## Success Criteria

### Phase 1 (Templates)
- [ ] 95% template application success rate
- [ ] No performance degradation on admin calendar
- [ ] Positive user feedback from 5+ admin users
- [ ] Zero data corruption incidents

### Phase 2 (Next Available)
- [ ] 90% search success rate (finding available slots)
- [ ] < 2s average search response time
- [ ] Integration with existing booking flow
- [ ] No conflicts with restriction system

### Phase 3 (Full Rollout)
- [ ] Both features stable for 2+ weeks
- [ ] User adoption > 20% for new features
- [ ] Support ticket volume unchanged
- [ ] Performance metrics within baseline

## Risk Assessment

### High Risk
- **Template Conflicts**: Overlapping slot creation
- **Performance Impact**: Large date range operations
- **Data Integrity**: Concurrent booking modifications

### Medium Risk  
- **User Experience**: Feature discovery and adoption
- **Integration Issues**: Cross-feature interactions
- **Browser Compatibility**: Feature flag JavaScript errors

### Low Risk
- **Rollback Complexity**: Well-defined rollback procedures
- **Database Issues**: Additive-only migrations
- **Feature Isolation**: Independent flag controls

## Post-Rollout Actions

### Week 1
- [ ] Monitor error rates and performance metrics
- [ ] Collect user feedback via support channels
- [ ] Review audit logs for feature usage patterns
- [ ] Document any issues and resolutions

### Month 1
- [ ] Analyze feature adoption rates
- [ ] Optimize based on usage patterns
- [ ] Plan next feature flag rollouts
- [ ] Update documentation based on real usage

### Ongoing
- [ ] Regular feature flag cleanup (remove deprecated flags)
- [ ] Performance optimization based on metrics
- [ ] User training and documentation updates
- [ ] Continuous monitoring and alerting refinement