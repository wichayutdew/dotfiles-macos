# Comment voice

The draft GitLab comment is Business QA speaking to a developer. It says who the customer or caller is, what they do, and what they should see.

Keep class names, file paths, and test commands out of the draft. Those belong in the chat report.

Do not write "approved", "blocked", "LGTM", or "request changes".

## Shape

Use the checklist in SKILL.md.

- Checked lines state what was already shown, and where it was checked.
- Unchecked lines name the missing customer outcome and the proof to add in the same bullet.
- A line such as "please confirm the expected outcome" is too thin. Name the page or request, the action, and the result that still needs an owner decision.
- Use ticket AC numbers when the ticket has them. When the list is inferred from the code, use a short customer label and do not invent AC numbers.

## Example with acceptance criteria

This is the comment shape from [agoda-com-spa-mobile MR 53157](https://gitlab.agodadev.io/full-stack/monoliths/agoda-com-spa-mobile/-/merge_requests/53157). Checked lines stay in the comment. Only the gaps ask for new proof.

```markdown
**QA UAT review**

* [x] AC-1, AC-2. Checks the control and that no fetch happens [CXP A/A, A/B, B/A], [Desktop A/A, A/B].
* [x] AC-4: up to seven cards, order, two-line titles and price rules
* [x] AC-5: empty case, with no renderable activities, Landmarks selected when the failure happens
* [x] AC-6: signed-in save from the card body and from the heart

**MR owner to re-check**

* [ ] AC-3: loading skeleton before any tab click. Please add a screenshot or short video of the Things to do tab showing the skeleton carousel while the search is held back.
* [ ] Saving an activity in the Trip saving list.
* [ ] RTL and carousel navigation. Please add a screenshot in a right-to-left language (for example Arabic) showing the carousel arrows and card order.
```

## Example when the ticket has no acceptance criteria and no design

Do not number these as AC-1. Say in the chat report that the list was inferred from the code.

```markdown
**MR owner to re-check**

* [ ] Things to do tab under Location. A customer opens a property page, scrolls to Location, and selects Things to Do. The ticket does not say what each activity card must show. Please confirm the card contents and add a screenshot of the tab selected.
* [ ] Property with no activities. Should the Things to Do tab stay hidden, or should the customer see an empty carousel? Please add a screenshot of Location on that property.
* [ ] Feature turned off. Location stays as it is today, with no Things to Do tab. Please add a screenshot of the current Location section.
* [ ] Activities fail to load. What should the customer see instead of the carousel? Please add a screenshot of that failure.
```
