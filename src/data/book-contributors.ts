import contributorData from './book-contributors.json';

export interface ContributorRole {
  id: string;
  name: string;
}

// Performance Optimization: Hoist static Map lookup table outside function call
// to replace linear roles array search (.find) with O(1) hash map lookup.
const CONTRIBUTOR_ROLE_MAP = new Map<string, ContributorRole>(
  contributorData.roles.map(r => [r.id, r])
);

export const getContributorRoles = (): ContributorRole[] => {
  return contributorData.roles;
};

export const getContributorRoleName = (id: string): string => {
  const role = CONTRIBUTOR_ROLE_MAP.get(id);
  return role ? role.name : id;
};
