import { AuthOptions } from '../../resources/auth/types';
import { yamlJoin } from '../../utility';

export default {

    generateNewUniqueToken(): string { return Context.ResourceHandler.generateNewUniqueToken() },

    getAllAuthYaml(): string {
        const result: string[] = [];
        for (const [resourceId, validator] of Context.ResourceHandler.getAuths().entries())
            result.push(validator.getYaml(resourceId));
        return yamlJoin(result);
    },

    getAuth(resourceId: string) {
        return Context.ResourceHandler
            .getAuths()
            .get(resourceId);
    },

    insertOrUpdateAuth(resourceId: string, options: AuthOptions) {
        if (resourceId)
            Context.ResourceHandler.updateAuth(resourceId, options);
        else
            Context.ResourceHandler.addAuth(options);
    },

    deleteAuth(resourceId: string) {
        Context.ResourceHandler.deleteAuth(resourceId);
    },

    deleteAllAuth() {
        Context.ResourceHandler.deleteAllAuth();
    },

}
