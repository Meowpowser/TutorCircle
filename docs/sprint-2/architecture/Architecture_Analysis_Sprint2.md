## Architecture Analysis Report

### Styles considered

**Layered Architecture:** In this architecture, TutorCircle would have three different layers. The presentation layer would handle the screens for tutors, students, and admins, the Application/Domain layer would check permissions and apply the rules, while the Persistence layer would save and retrieve data. For example, when a student clicks the Join button, the request goes to the Group module, and it checks if the student can join before the membership is saved.

**Microservice Architecture:** With microservices, TutorCircle could be split into separate services for accounts and profiles, tutor management, tutoring groups, and support tickets. Each service would be able to handle its own data and could be deployed on its own. The services would communicate through APIs or messages, and the Tutoring Group service would be responsible for who belongs to each group and how many places are available.

### Comparison

**Scalability:** If more students start using TutorCircle, we could run more copies of the layered backend to handle the extra traffic, but we would be scaling the whole backend together. With microservices, if most of that traffic comes from students browsing and joining groups, we could scale just the Tutoring Group service.

**Security:** With one layered backend, we would have a singular place to check whether someone is an admin before they are able to approve a tutor and whether they have permissions to open a private group chat. Microservices would let us keep each service’s data separate, but we would also have to check which services are allowed to call each other, and what information they can access.

**Maintainability:** In the layered design, the Group module would contain both the capacity rule and the rule that stops a student from joining twice, so if we change either rule, we know where we should make the change and test it. With microservices, we could update and release a service on its own, but if the change affects another service, we would have to check that their APIs still work together.

**Team fit:** Since there are five of us and we had a total of 4 weeks to complete Sprint 2, it would be easier to divide the work by module and then test everything together in one backend release. With microservices, we would also have to set up separate deployments, monitor each service, and then decide what happens when a call between services fails.

### Decision matrix

| Criteria | Weight | Layered Architecture | Microservices |
| --- | ---: | --- | --- |
| Scalability | 20% | 3, Ability to scale the backend as a whole | 5, Ability to scale a business service on its own |
| Security | 25% | 4, Fewer network connections to secure | 3, Each service has separate data, calls between services need security checks |
| Maintainability | 25% | 5, Related rules stay in the same module, easier to find/test | 4, Services can release separately, however APIs need to be compatible |
| Team Fit | 30% | 5, all five team members can divide the module work, test, then release together | 2, Separate deployments and monitoring add more work |
| **Total** | **100%** | **4.35/5** | **3.35/5** |

_Table 5: Architecture Decision Matrix_

We scored each architecture from 1 to 5, (1 being a weak fit and 5 being a strong one), based off of what TutorCircle needs. We gave team fit the highest weight because of our team size and the sprint deadline, and we gave security and maintainability 25% each because we need to protect private information and keep the code manageable as we continue to work on features for different roles. We also gave scalability 20% because the project is designed initially for AUBH, and we calculated the total by multiplying the scores by their weights and ultimately adding the results.

### Final choice and justification

Ultimately, we decided to go with **Layered Architecture with one modular backend**. It fits the work our five-person team needs to complete within the 4 weeks. We can divide the features between us and still test how the Student, Tutor, and Admin workflows work together. The main trade-off however is that the backend modules are released together, and we could reconsider this decision later if one part of TutorCircle needs to be scaled independently.

For US-04, Join Tutoring Groups, when a student clicks the Join button, the Group module checks if they are eligible, if the group has space, and if they are already a member. In a shared deployment, the capacity check and the membership update would happen in one database transaction with concurrency control, so if two students try to join when there is only one space left, one should get the place and the other should see a message which states that the group is full.

For US-10, Approve Tutor Applications, the backend checks the user’s AUBH identity and role before letting them approve a tutor, since that action is made for admins. We apply the same idea to private group chats where the Application/Domain layer checks that the person is a group member or an authorized admin, and we can test both rules by trying to use those features with accounts which do not have permission.

### Design patterns

**Repository for joining tutoring group US-04.** When a student tries to join a group, the Group module uses a Group Repo to get the group membership records, then it checks the capacity and whether a student has already joined. If the checks pass, the repo saves the membership, which lets us keep the join rules in the Group module and change how the data is stored without rewriting those rules.

**Observer for tutoring request status updates US-08.** When a tutor accepts or declines a request, the Application/Domain layer checks that they have permission and saves the new status, then the request state in the active session tells the request list and the status panel to update. That way both parts of the screen show the same saved status, and if the save fails, they keep showing the previous status while the interface displays an error.
