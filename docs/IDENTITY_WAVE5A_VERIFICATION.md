# Wave 5a Identity / Bootstrap Verification
Status: IMPLEMENTED ON BRANCH / CI PENDING

Scope:
- Transactional new-user bootstrap: profile → personal/default organization → owner membership → organization-bound trial license.
- Seat-member login no longer depends on a personal license row before organization context is loaded.
- Email OTP login uses `shouldCreateUser:false`; account creation is a separate explicit signup action.
- Invitation acceptance runs before organization-context bootstrap so accepted membership is included in the same context load.

Gates:
- Disposable PostgreSQL bootstrap/rollback assertions.
- Static identity/auth invariants.
- Real-DOM OTP mode assertions.

NOT VERIFIED:
- Persistent two-real-user production E2E with a legitimate non-owner member.
- Suspension/offboarding client cache/session purge.
- External invitation email delivery.
