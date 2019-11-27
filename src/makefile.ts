import { Rule } from './rule'
import { Make } from './make'
import { Logger } from './utils/logger'
import { Prerequisites, PrerequisitesDeclaration } from './prerequisites'
import { Target, TargetDeclaration } from './target'
import { cwd } from 'process'
import { Recipe, RecipeDeclaration } from './recipe'

const defaultRecipe = () => void (0)

export class Makefile {
    public root: string
    public verbose: boolean

    private fileTargetRules: Map<string, Rule> = new Map()
    private ruleMap: Map<TargetDeclaration, Rule> = new Map()
    private ruleList: Rule[] = []
    private logger: Logger

    constructor (root = cwd(), verbose = false) {
        this.root = root
        this.verbose = verbose
        this.logger = new Logger(verbose)
    }

    public updateOrAddRule (
        targetDecl: TargetDeclaration,
        prerequisitesDecl: PrerequisitesDeclaration,
        recipeDecl: RecipeDeclaration<void> = defaultRecipe
    ) {
        if (this.ruleMap.has(targetDecl)) {
            this.updateRule(targetDecl, prerequisitesDecl, recipeDecl)
        } else {
            this.addRule(targetDecl, prerequisitesDecl, recipeDecl)
        }
    }

    public addRule (
        targetDecl: TargetDeclaration,
        prerequisitesDecl: PrerequisitesDeclaration,
        recipeDecl: RecipeDeclaration<void> = defaultRecipe
    ) {
        const target = new Target(targetDecl)
        const prerequisites = new Prerequisites(prerequisitesDecl)
        const recipe = new Recipe(recipeDecl)
        const rule = new Rule(target, prerequisites, recipe)
        if (target.isFilePath()) {
            this.fileTargetRules.set(target.decl, rule)
        }
        this.ruleList.push(rule)
        this.ruleMap.set(target.decl, rule)
    }

    public updateRule (
        targetDecl: TargetDeclaration,
        prerequisitesDecl: PrerequisitesDeclaration,
        recipeDecl: RecipeDeclaration<void> = defaultRecipe
    ) {
        const rule = this.ruleMap.get(targetDecl)
        rule.prerequisites = new Prerequisites(prerequisitesDecl)
        rule.recipe = new Recipe(recipeDecl)
    }

    public async make (target?: string): Promise<boolean> {
        if (!target) {
            target = this.findFirstTargetOrThrow()
        }
        return new Make(this.root, this.logger, target => this.findRule(target)).make(target)
    }

    private findRule (target: string): [Rule, RegExpExecArray] {
        if (this.fileTargetRules.has(target)) {
            const match: RegExpExecArray = [target] as RegExpExecArray
            match.input = target
            match.index = 0
            return [this.fileTargetRules.get(target), match]
        }
        for (let i = this.ruleList.length - 1; i >= 0; i--) {
            const rule = this.ruleList[i]
            const match = rule.match(target)
            if (match) {
                return [rule, match]
            }
        }
        return [null, null]
    }

    private findFirstTarget (): string {
        for (const rule of this.ruleList) {
            if (rule.target.isFilePath()) return rule.target.decl
        }
    }

    private findFirstTargetOrThrow () {
        const target = this.findFirstTarget()
        if (!target) throw new Error('target not found')
        return target
    }
}
