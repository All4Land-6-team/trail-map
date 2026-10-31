export type CommunityClusterPoint<T> = { value: T; x: number; y: number }

function center<T>(group: readonly CommunityClusterPoint<T>[]) {
  return {
    x: group.reduce((sum, point) => sum + point.x, 0) / group.length,
    y: group.reduce((sum, point) => sum + point.y, 0) / group.length,
  }
}

export function groupCommunityMapPoints<T>(points: readonly CommunityClusterPoint<T>[], distance: number) {
  let groups = points.map(point => [point])

  while (groups.length > 1) {
    const parents = groups.map((_, index) => index)
    const find = (index: number): number => parents[index] === index ? index : (parents[index] = find(parents[index]))
    const merge = (left: number, right: number) => {
      const leftRoot = find(left)
      const rightRoot = find(right)
      if (leftRoot !== rightRoot) parents[rightRoot] = leftRoot
    }
    const centers = groups.map(center)

    for (let left = 0; left < groups.length; left += 1) {
      for (let right = left + 1; right < groups.length; right += 1) {
        if (Math.hypot(centers[left].x - centers[right].x, centers[left].y - centers[right].y) < distance) merge(left, right)
      }
    }

    const merged = new Map<number, CommunityClusterPoint<T>[]>()
    groups.forEach((group, index) => {
      const root = find(index)
      merged.set(root, [...(merged.get(root) ?? []), ...group])
    })
    if (merged.size === groups.length) return groups
    groups = [...merged.values()]
  }

  return groups
}

export function spreadCommunityMapPoints<T>(points: readonly CommunityClusterPoint<T>[], distance: number, spacing: number) {
  return groupCommunityMapPoints(points, distance).flatMap(group => {
    if (group.length === 1) return group
    const groupCenter = center(group)
    const radius = spacing / (2 * Math.sin(Math.PI / group.length))
    return group.map((point, index) => {
      const angle = -Math.PI / 2 + (Math.PI * 2 * index) / group.length
      return { ...point, x: groupCenter.x + Math.cos(angle) * radius, y: groupCenter.y + Math.sin(angle) * radius }
    })
  })
}
