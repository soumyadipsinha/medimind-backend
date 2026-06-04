
export function evaluateWorkflowSteps(workflowTemplate, parameterValues = {}) {
	const { parameters = [], steps = [] } = workflowTemplate;

	// Build a map of parameter names to values, defaulting to defaultValue from template
	const finalParameters = {};
	parameters.forEach((param) => {
		finalParameters[param.name] =
			parameterValues[param.name] !== undefined
				? parameterValues[param.name]
				: param.defaultValue;
	});

	// Filter steps based on visibility conditions
	const activeSteps = steps.filter((step) => {
		if (!step.visibilityConditions || step.visibilityConditions.length === 0) {
			return true;
		}

		// Currently implementing simple AND logic for conditions
		return step.visibilityConditions.every((condition) => {
			const { parameterName, operator, value } = condition;
			const actualValue = finalParameters[parameterName];

			switch (operator) {
				case "eq":
					return actualValue === value;
				case "neq":
					return actualValue !== value;
				case "gt":
					return Number(actualValue) > Number(value);
				case "lt":
					return Number(actualValue) < Number(value);
				case "in":
					return Array.isArray(value) && value.includes(actualValue);
				default:
					return true;
			}
		});
	});

	return {
		steps: activeSteps,
		parameters: finalParameters,
	};
}
