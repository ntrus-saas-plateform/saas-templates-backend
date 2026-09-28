-- Remove permissions that existed only for deleted industry modules.
DELETE FROM role_permissions
WHERE permission_id IN (
  SELECT id FROM permissions
  WHERE resource IN ('pharmacy', 'insurance', 'kitchen', 'hospitality', 'prescription', 'dispensing', 'clinical_safety')
     OR resource LIKE 'pharmacy%'
     OR resource LIKE 'insurance%'
);

DELETE FROM permissions
WHERE resource IN ('pharmacy', 'insurance', 'kitchen', 'hospitality', 'prescription', 'dispensing', 'clinical_safety')
   OR resource LIKE 'pharmacy%'
   OR resource LIKE 'insurance%';
