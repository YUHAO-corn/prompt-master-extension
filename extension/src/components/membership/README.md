# Membership Components

This directory contains components related to the membership and pro features.

## Components

### ProBadge

A badge that indicates the user's membership status (free or pro).

```tsx
<ProBadge isActive={isProMember} onClick={handleClick} size="md" />
```

### UpgradeButton

A button that encourages users to upgrade to the pro version.

```tsx
<UpgradeButton isProMember={isProMember} source="sidebar" />
```

### ProPlanCard

A card that displays the pro plan details, including benefits and pricing. This component is typically used with PlanCardConnector.

```tsx
<ProPlanCard
  anchorEl={anchorElement}
  isVisible={showCard}
  onClose={handleClose}
  onUpgradeClick={handleUpgrade}
  showPromotion={true}
/>
```

### PlanCardConnector

A connector component that manages the visibility of the ProPlanCard when hovering over or clicking on a trigger element (like ProBadge or UpgradeButton).

```tsx
// With ProBadge
<PlanCardConnector triggerType="hover" source="badge">
  <ProBadge isActive={false} />
</PlanCardConnector>

// With UpgradeButton
<PlanCardConnector triggerType="hover" source="button">
  <UpgradeButton isProMember={false} />
</PlanCardConnector>
```

### DevMembershipTools

A development-only component for testing different membership states.

```tsx
<DevMembershipTools />
```

## Usage Examples

### Typical Navigation Usage

```tsx
import { ProBadge, UpgradeButton, PlanCardConnector } from '../components/membership';
import { useMembership } from '../hooks/useMembership';

const Navigation = () => {
  const { isProMember } = useMembership();
  
  return (
    <div className="navigation">
      {/* User profile with ProBadge */}
      <div className="profile">
        <PlanCardConnector triggerType="hover" source="badge">
          <ProBadge isActive={isProMember} />
        </PlanCardConnector>
        <Avatar />
      </div>
      
      {/* Upgrade button in sidebar */}
      <div className="sidebar-footer">
        <PlanCardConnector triggerType="hover" source="upgrade_button">
          <UpgradeButton isProMember={isProMember} />
        </PlanCardConnector>
      </div>
    </div>
  );
};
``` 