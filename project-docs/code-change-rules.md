**Code change rules for AI to follow** 
When making code changes, follow these instructions:
* Only change code directly related to the problem at hand.
* Strictly follow the principles listed in '.\project-docs\software_engineering_principles.md'. Do not deviate from them.
* Do not make assumptions. Instead, if you lack information, stop and ask me.
* If you update one part of the code, ensure that you also update all the dependent other parts of the code, including those in other files. For example, if you update function 'A' in 'file1.ts', then be sure to also update any code in other files which are called by function 'A' or which call function 'A'. 
* When changing code, insert comments which explain the context, the business logic, and the reasoning for changing this code. 
* Before changing a database, take a back-up or document the detailed schema so that a roll-back is possible if things go wrong. 
* Read '.\project-docs\code2graph-prd.md', '.\project-docs\code2graph-architecture.md', and '.\project-docs\code2graph-project-plan.md' to understand the context and overall goal. If you detect inconsistencies between these documents and my current request, stop, describe the inconsistency, and ask me for more information. 