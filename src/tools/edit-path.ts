export interface ServarrPathEdit {
  rootFolderPath?: string;
  path?: string;
  resourceName: string;
}

function normalizedPath(value: string): string {
  return value.replace(/\\/g, "/").replace(/\/+$/, "");
}

export function rebaseServarrPath(
  currentPath: string,
  rootFolderPath: string,
): string {
  const trimmedCurrent = currentPath.replace(/[\\/]+$/, "");
  const leaf = trimmedCurrent.split(/[\\/]/).at(-1);
  if (!leaf) {
    throw new Error(
      `Cannot derive a destination from current path ${currentPath}`,
    );
  }

  const separator =
    rootFolderPath.includes("\\") && !rootFolderPath.includes("/") ? "\\" : "/";
  const trimmedRoot = rootFolderPath.replace(/[\\/]+$/, "");
  if (!trimmedRoot) {
    return `${separator}${leaf}`;
  }
  return `${trimmedRoot}${separator}${leaf}`;
}

export function applyServarrPathEdit(
  resource: Record<string, unknown>,
  edit: ServarrPathEdit,
): string | undefined {
  let expectedPath = edit.path;

  if (edit.rootFolderPath !== undefined) {
    resource.rootFolderPath = edit.rootFolderPath;
    if (expectedPath === undefined) {
      if (typeof resource.path !== "string" || !resource.path.trim()) {
        throw new Error(
          `${edit.resourceName} has no usable current path; pass path explicitly with root_folder_path`,
        );
      }
      expectedPath = rebaseServarrPath(resource.path, edit.rootFolderPath);
    }
  }

  if (expectedPath !== undefined) {
    resource.path = expectedPath;
  }
  return expectedPath;
}

export function assertServarrPathEditApplied(
  result: unknown,
  expectedPath: string | undefined,
  resourceName: string,
): void {
  if (expectedPath === undefined) return;

  const actualPath =
    result && typeof result === "object" && "path" in result
      ? (result as Record<string, unknown>).path
      : undefined;
  if (
    typeof actualPath !== "string" ||
    normalizedPath(actualPath) !== normalizedPath(expectedPath)
  ) {
    const actual =
      typeof actualPath === "string" ? actualPath : "<missing path>";
    throw new Error(
      `${resourceName} path update did not take effect: expected ${expectedPath}, upstream returned ${actual}`,
    );
  }
}
