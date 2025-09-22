import type { IssueResponse, Issue, Spec, Rule } from '../utils/mod.ts'
import { structure, macros, rules } from './test-spec.ts'

// Type for actual file system structure
type FileSystemNode = {
  type: 'file' | 'directory'
  name: string
  extension?: string
  children?: Map<string, FileSystemNode>
}

// Cache for expanded macros
const macroCache = new Map<string, Spec>()

/**
 * Helper function to expand macros with tracking of current macro being expanded
 */
function expandMacrosWithDepth(
  spec: Spec,
  macroDefinitions: Record<string, Spec>,
  currentMacro: string | null,
  depth: number
): Spec {
  // Prevent infinite recursion with a depth limit
  if (depth > 10) {
    return spec // Stop expanding at depth 10 to prevent infinite recursion
  }

  if (typeof spec === 'string') {
    // Check if it's a macro reference
    if (spec.startsWith('#')) {
      const macroName = spec.substring(1)

      // If it's a self-reference, don't expand further
      if (macroName === currentMacro) {
        return spec // Keep the macro reference for recursive structures
      }

      // Check if macro exists
      if (!macroDefinitions[macroName]) {
        throw new Error(`Macro not found: #${macroName}`)
      }

      // Expand the macro
      return expandMacrosWithDepth(macroDefinitions[macroName], macroDefinitions, macroName, depth + 1)
    }
    // Check if it's a rule reference (don't expand)
    if (spec.startsWith('@')) {
      return spec
    }
    // Regular string (file extension)
    return spec
  }

  if (Array.isArray(spec)) {
    // Expand each item in the array
    return spec.map(item => expandMacrosWithDepth(item, macroDefinitions, currentMacro, depth))
  }

  if (typeof spec === 'object' && spec !== null) {
    // Expand each value in the object
    const expanded: Record<string, Spec> = {}
    for (const [key, value] of Object.entries(spec)) {
      expanded[key] = expandMacrosWithDepth(value, macroDefinitions, currentMacro, depth)
    }
    return expanded
  }

  return spec
}

/**
 * Expand all macro references in a spec
 */
function expandMacros(spec: Spec, macroDefinitions: Record<string, Spec>): Spec {
  return expandMacrosWithDepth(spec, macroDefinitions, null, 0)
}

/**
 * Scan a directory and build a tree representation
 */
async function scanDirectory(path: string): Promise<FileSystemNode> {
  const name = path.split('/').pop() || ''

  try {
    const stat = await Deno.stat(path)

    if (stat.isFile) {
      const parts = name.split('.')
      const extension = parts.length > 1 ? parts.slice(1).join('.') : undefined
      return {
        type: 'file',
        name: parts[0],
        extension
      }
    }

    if (stat.isDirectory) {
      const children = new Map<string, FileSystemNode>()

      // Skip common ignore patterns
      const ignoredDirs = ['node_modules', '.git', 'dist', '.cache']
      if (ignoredDirs.includes(name)) {
        return {
          type: 'directory',
          name,
          children
        }
      }

      for await (const entry of Deno.readDir(path)) {
        const childPath = `${path}/${entry.name}`
        const child = await scanDirectory(childPath)
        children.set(entry.name, child)
      }

      return {
        type: 'directory',
        name,
        children
      }
    }

    // Symlinks or other types - treat as file
    return {
      type: 'file',
      name
    }
  } catch (error) {
    // If we can't read it, treat it as missing
    return {
      type: 'file',
      name
    }
  }
}

/**
 * Check if a node matches a file extension spec
 */
function matchesFileExtension(node: FileSystemNode, extension: string): boolean {
  if (node.type !== 'file') return false

  // Handle multi-part extensions like "test.ts" or "d.ts"
  if (extension.includes('.')) {
    const expectedParts = extension.split('.')
    const actualName = node.name + (node.extension ? '.' + node.extension : '')
    return actualName.endsWith('.' + extension)
  }

  return node.extension === extension
}

/**
 * Validate a single node against a spec
 */
async function validateNode(
  spec: Spec,
  actual: FileSystemNode | undefined,
  path: string,
  issues: Issue[],
  ruleDefinitions: Record<string, Rule>
): Promise<void> {
  // Handle rule references
  if (typeof spec === 'string' && spec.startsWith('@')) {
    const ruleName = spec.substring(1)
    if (ruleDefinitions[ruleName]) {
      const result = await ruleDefinitions[ruleName](path)
      if (result) {
        issues.push({
          issue: result,
          location: path
        })
      }
    }
    return
  }

  // Handle file extension specs
  if (typeof spec === 'string') {
    if (!actual) {
      issues.push({
        issue: `Expected file with extension .${spec}`,
        location: path
      })
    } else if (!matchesFileExtension(actual, spec)) {
      if (actual.type === 'directory') {
        issues.push({
          issue: `Expected file with extension .${spec}, but found directory`,
          location: path
        })
      } else {
        issues.push({
          issue: `Expected file with extension .${spec}, but found .${actual.extension || 'no extension'}`,
          location: path
        })
      }
    }
    return
  }

  // Handle array specs (any-of)
  if (Array.isArray(spec)) {
    // Try each spec in the array
    let matched = false
    const tempIssues: Issue[] = []

    for (const subSpec of spec) {
      const subIssues: Issue[] = []
      await validateNode(subSpec, actual, path, subIssues, ruleDefinitions)
      if (subIssues.length === 0) {
        matched = true
        break
      }
      tempIssues.push(...subIssues)
    }

    if (!matched) {
      const specDescriptions = spec.map(s => {
        if (typeof s === 'string') {
          if (s.startsWith('@')) return `rule:${s.substring(1)}`
          if (s.startsWith('#')) return `macro:${s.substring(1)}`
          return `.${s}`
        }
        return 'directory'
      })

      if (!actual) {
        issues.push({
          issue: `Expected one of: ${specDescriptions.join(', ')}`,
          location: path
        })
      } else {
        issues.push({
          issue: `Does not match any of: ${specDescriptions.join(', ')}`,
          location: path
        })
      }
    }
    return
  }

  // Handle object specs (directory structure)
  if (typeof spec === 'object' && spec !== null) {
    if (!actual) {
      issues.push({
        issue: `Expected directory`,
        location: path
      })
      return
    }

    if (actual.type !== 'directory') {
      issues.push({
        issue: `Expected directory, but found file`,
        location: path
      })
      return
    }

    const children = actual.children || new Map()
    const processedChildren = new Set<string>()

    for (const [key, childSpec] of Object.entries(spec)) {
      if (key === '...') {
        // Wildcard - validate all children against this spec
        for (const [childName, childNode] of children) {
          if (!processedChildren.has(childName)) {
            await validateNode(childSpec, childNode, `${path}/${childName}`, issues, ruleDefinitions)
            processedChildren.add(childName)
          }
        }
      } else if (key.endsWith('?')) {
        // Optional directory
        const dirName = key.slice(0, -1)
        // First try exact match
        let childNode = children.get(dirName)
        let usedName = dirName

        // If not found and spec is a file extension, try with extension
        if (!childNode && typeof childSpec === 'string' && !childSpec.startsWith('#') && !childSpec.startsWith('@')) {
          const withExt = `${dirName}.${childSpec}`
          childNode = children.get(withExt)
          if (childNode) {
            usedName = withExt
          }
        }

        if (childNode) {
          await validateNode(childSpec, childNode, `${path}/${dirName}`, issues, ruleDefinitions)
          processedChildren.add(usedName)
        }
        // If not present, that's okay (it's optional)
      } else {
        // Exact name match
        // First try exact match
        let childNode = children.get(key)
        let usedName = key

        // If not found and spec is a file extension, try with extension
        if (!childNode && typeof childSpec === 'string' && !childSpec.startsWith('#') && !childSpec.startsWith('@')) {
          const withExt = `${key}.${childSpec}`
          childNode = children.get(withExt)
          if (childNode) {
            usedName = withExt
          }
        }

        await validateNode(childSpec, childNode, `${path}/${key}`, issues, ruleDefinitions)
        if (childNode) {
          processedChildren.add(usedName)
        }
      }
    }

    // Check for unexpected files (not in spec)
    if (!spec['...']) {
      for (const [childName, childNode] of children) {
        if (!processedChildren.has(childName)) {
          // Check if it matches an optional directory pattern
          let matchesOptional = false
          for (const key of Object.keys(spec)) {
            if (key.endsWith('?') && key.slice(0, -1) === childName) {
              matchesOptional = true
              break
            }
          }

          if (!matchesOptional) {
            issues.push({
              issue: `Unexpected ${childNode.type}`,
              location: `${path}/${childName}`
            })
          }
        }
      }
    }
  }
}

/**
 * Main validation function
 */
export async function validateStructure(targetDir: string = '.'): Promise<IssueResponse> {
  try {
    // Phase 1: Load and prepare (specs are imported directly)
    const expandedSpec = expandMacros(structure, macros)

    // Phase 2: Scan file system
    const actualStructure = await scanDirectory(targetDir)

    // Phase 3: Validate structure
    const issues: Issue[] = []

    // Validate the contents of the target directory, not the directory itself
    if (actualStructure.type === 'directory' && actualStructure.children) {
      // Treat the expanded spec as the expected contents of the target directory
      if (typeof expandedSpec === 'object' && !Array.isArray(expandedSpec)) {
        const processedChildren = new Set<string>()

        for (const [key, childSpec] of Object.entries(expandedSpec)) {
          if (key === '...') {
            // Wildcard - validate all children
            for (const [childName, childNode] of actualStructure.children) {
              if (!processedChildren.has(childName)) {
                await validateNode(childSpec, childNode, `${targetDir}/${childName}`, issues, rules || {})
                processedChildren.add(childName)
              }
            }
          } else if (key.endsWith('?')) {
            // Optional directory
            const dirName = key.slice(0, -1)
            // Look for exact directory match or file with extension
            let childNode = actualStructure.children.get(dirName)

            if (!childNode && typeof childSpec === 'string') {
              // Try with extension for files
              const withExt = `${dirName}.${childSpec}`
              childNode = actualStructure.children.get(withExt)
              if (childNode) {
                processedChildren.add(withExt)
              }
            } else if (childNode) {
              processedChildren.add(dirName)
            }

            if (childNode) {
              await validateNode(childSpec, childNode, `${targetDir}/${dirName}`, issues, rules || {})
            }
          } else {
            // Exact name match
            let childNode = actualStructure.children.get(key)
            let actualKey = key

            // If we're looking for a file and didn't find exact match, try with extension
            if (!childNode && typeof childSpec === 'string') {
              const withExt = `${key}.${childSpec}`
              childNode = actualStructure.children.get(withExt)
              if (childNode) {
                actualKey = withExt
                processedChildren.add(withExt)
              }
            } else if (childNode) {
              processedChildren.add(key)
            }

            await validateNode(childSpec, childNode, `${targetDir}/${key}`, issues, rules || {})
          }
        }

        // Check for unexpected files
        const specKeys = Object.keys(expandedSpec)
        const hasWildcard = specKeys.includes('...')

        if (!hasWildcard) {
          for (const [childName] of actualStructure.children) {
            if (!processedChildren.has(childName)) {
              const childNode = actualStructure.children.get(childName)!
              issues.push({
                issue: `Unexpected ${childNode.type}`,
                location: `${targetDir}/${childName}`
              })
            }
          }
        }
      } else {
        // If spec is not a directory spec, validate against the directory itself
        await validateNode(expandedSpec, actualStructure, targetDir, issues, rules || {})
      }
    } else {
      // Not a directory, validate as-is
      await validateNode(expandedSpec, actualStructure, targetDir, issues, rules || {})
    }

    // Phase 4: Return IssueResponse format
    return {
      name: `validate-structure: ${targetDir}`,
      issues: issues,
      message: issues.length === 0
        ? "All validations passed"
        : `Found ${issues.length} validation issue(s)`
    }
  } catch (error) {
    return {
      name: `validate-structure: ${targetDir}`,
      issues: [{
        issue: error.message,
        location: targetDir
      }],
      message: `Validation failed: ${error.message}`
    }
  }
}

// Main CLI entry point
if (import.meta.main) {
  const targetDir = Deno.args[0] || '.'
  const result = await validateStructure(targetDir)

  // Display results
  if (result.issues.length === 0) {
    console.log('✅', result.message)
    Deno.exit(0)
  } else {
    for (const issue of result.issues) {
      console.log(`❌ ${issue.location}: ${issue.issue}`)
    }
    console.log(`\n${result.message}`)
    Deno.exit(1)
  }
}