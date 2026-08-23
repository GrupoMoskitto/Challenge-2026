---
description: Frontend rules for URL and state synchronization to prevent render loops.
trigger: model_decision
---

# Frontend One-Way Sync Pattern

**Core Directive:** 
Sync URL parameters to local React state via a single `useEffect`. However, you MUST ONLY push state back to the URL (using `setSearchParams`) inside manual interaction handlers (e.g., `onClick`, `onChange`). This pattern completely eliminates infinite render loops between URL and component state.

**Explicit Anti-Patterns:**
- **NEVER** write a reactive `useEffect` that listens to a state variable like `[activeTab]` to call `setSearchParams()`.
- **NEVER** update the URL history without verifying if the new state actually differs from the current URL parameter.

**TypeScript Template:**
```tsx
import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export function PatientDashboardTabs() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState('clinical-data');

  // One-Way Sync: URL changes -> Local State
  useEffect(() => {
    const tabFromUrl = searchParams.get('tab');
    if (tabFromUrl && tabFromUrl !== activeTab) {
      setActiveTab(tabFromUrl);
    }
    // Only tracking searchParams prevents reactivity loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Manual trigger: User Interaction -> URL Update
  const handleTabChange = useCallback((newTab: string) => {
    setActiveTab(newTab);
    
    // Equality check to avoid redundant history stack pushes
    if (searchParams.get('tab') !== newTab) {
      const newParams = new URLSearchParams(searchParams);
      newParams.set('tab', newTab);
      setSearchParams(newParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange}>
      <TabsList>
        <TabsTrigger value="clinical-data">Clinical Data</TabsTrigger>
        <TabsTrigger value="documents">Documents</TabsTrigger>
      </TabsList>
      <TabsContent value="clinical-data" className="transition-opacity">
        {/* Content */}
      </TabsContent>
      <TabsContent value="documents" className="transition-opacity">
        {/* Content */}
      </TabsContent>
    </Tabs>
  );
}
```
