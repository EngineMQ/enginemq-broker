import { ValidatorOptions } from '../../resources/validator/types';
import { yamlJoin } from '../../utility';

export default {

    getAllValidatorsYaml(): string {
        const result: string[] = [];
        for (const [resourceId, validator] of Context.ResourceHandler.getValidators().entries())
            result.push(validator.getYaml(resourceId));
        return yamlJoin(result);
    },

    getValidator(resourceId: string) {
        return Context.ResourceHandler
            .getValidators()
            .get(resourceId);
    },

    insertOrUpdateValidator(resourceId: string, options: ValidatorOptions) {
        if (resourceId)
            Context.ResourceHandler.updateValidator(resourceId, options);
        else
            Context.ResourceHandler.addValidator(options);
    },

    deleteValidator(resourceId: string) {
        Context.ResourceHandler.deleteValidator(resourceId);
    },

    deleteAllValidator() {
        Context.ResourceHandler.deleteAllValidator();
    },

}
