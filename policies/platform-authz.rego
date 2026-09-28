# Platform authorization policy (OPA) — mirrors in-process RBAC + org ABAC baseline.
# Deploy: opa run --server policies/
# Evaluate: POST /v1/data/platform/authz/allow { "input": { ...PolicyEvaluationContext } }

package platform.authz

default allow = false

allow if {
  permission_allowed
  org_access_allowed
}

permission_allowed if {
  some perm in input.permissions
  perm == sprintf("%s:%s", [input.resource.type, input.action])
}

permission_allowed if {
  some perm in input.permissions
  perm == input.action
}

org_access_allowed if {
  input.organizationId == null
}

org_access_allowed if {
  input.resource.attributes.organizationId == null
}

org_access_allowed if {
  input.organizationId == input.resource.attributes.organizationId
}
