# Video Game Transcript Archive

## 1. Overview

The application is a web archive for video game story transcripts. Normal users can browse and search story content by category, select a specific section, and read the associated transcript. Administrators have an additional interface for adding new transcripts. Transcripts contain speakers, dialogue lines, descriptions, and interactive choices.

The archive must represent dialogue affected by protagonist gender and by user-selected choices. Choices may contain additional dialogue and nested choices.

## 2. Goals

- Provide a clear way to browse all archived story content.
- Allow normal users to search and view archived transcripts.
- Allow administrators to add new transcripts through a protected admin interface.
- Make transcripts easy to read and navigate.
- Allow users to change the main character's gender.
- Show dialogue changes caused by the selected gender.
- Allow users to select different choices in the same dialogue and immediately view the affected lines.
- Support choices nested inside choice-dependent dialogue.
- Provide stable, shareable URLs for story sections and transcripts.

## 3. User Roles and Interfaces

### 3.1 Normal user interface

Normal users can:

- Open the home screen.
- Browse main story, event story, and interrogation content.
- Search the transcript archive.
- Select chapters, events, stages, characters, and interrogation parts.
- Read transcripts.
- Change the protagonist gender between male and female.
- Interact with transcript choices.

Normal users cannot:

- Add, edit, or delete transcripts.
- Manage users or permissions.
- Access the administration interface.

### 3.2 Admin user interface

Administrators can:

- Sign in to the administration interface.
- Add a new main story transcript.
- Add a new event story transcript.
- Add a new interrogation transcript.
- Enter speakers, lines, descriptions, choices, and nested choices.
- Define male and female dialogue variants.
- Assign a transcript to the correct chapter, event, stage, character, or interrogation part.
- Validate and publish a transcript.

The admin interface should provide validation errors before a transcript can be published. Admin-only routes and APIs must reject unauthenticated or unauthorized requests.

The initial admin scope is adding new transcripts. Editing and deleting existing transcripts may be added later, but are outside the initial release unless explicitly implemented.

## 4. Content Categories

The archive has three top-level content categories:

1. Main story
2. Event story
3. Interrogation

## 4. Navigation Requirements

### 4.1 Home screen

The home screen must provide entry points to:

- Main story
- Event story
- Interrogation

### 4.2 Main story flow

```text
Home -> Main story -> Chapter selection -> Stage selection -> Transcript
```

Requirements:

- Display available chapters.
- Display stages belonging to the selected chapter.
- Open the transcript for the selected stage.
- Preserve the selected chapter and stage in the URL.

### 4.3 Event story flow

```text
Home -> Event story -> Event selection -> Stage selection -> Transcript
```

Requirements:

- Display available events.
- Display stages belonging to the selected event.
- Open the transcript for the selected stage.
- Preserve the selected event and stage in the URL.

### 4.4 Interrogation flow

```text
Home -> Interrogation -> Character selection -> Part selection -> Transcript
```

Requirements:

- Display available interrogation characters.
- Display interrogation parts belonging to the selected character.
- Open the transcript for the selected part.
- Preserve the selected character and part in the URL.

## 5. Transcript Requirements

Each transcript may contain the following content types:

- Speaker name
- Dialogue line
- Description or narration
- Choice prompt
- Choice option
- Choice-dependent dialogue
- Nested choices

The transcript reader must:

- Display content in chronological order.
- Visually distinguish speakers, descriptions, choices, and selected branches.
- Keep the current choice visible after an option is selected.
- Replace or update only the affected branch when the user selects another option.
- Allow the user to switch between options in the same dialogue.
- Render choices contained inside an affected branch.
- Support transcript sections with no choices.

## 6. Choice Interaction

When a user selects a choice option:

1. Record the selected option for that choice.
2. Display the lines affected by that option.
3. Hide or replace the lines belonging exclusively to the previously selected option.
4. Preserve the choice prompt and all available options.
5. Render any nested choices in the selected branch.

Selecting another option in the same choice must update the branch without reloading the page.

Choice selections should be isolated by choice identifier. Selecting one choice must not unintentionally change an unrelated choice.

## 7. Protagonist Gender

The transcript reader must provide a way to select the main character's gender. The only supported values are:

- Male
- Female

Changing the gender must update all dialogue and descriptions affected by that setting.

The selected gender should remain active while browsing the current transcript. The application may persist it across transcripts using local storage or a user preference, provided the user can change it at any time.

Gender-dependent content may affect:

- Pronouns
- Character names or titles
- Verb agreement
- Description text
- Dialogue lines
- Choice labels

## 8. Suggested Content Model

Transcript content should be stored as structured data rather than as pre-rendered HTML. A transcript is a tree of nodes so that a choice can contain dialogue and further choices.

Example TypeScript model:

```ts
type DialogueNode =
  | {
      type: 'line';
      id: string;
      speaker?: string;
      text: string;
      description?: string;
      variants?: {
        male: string;
        female: string;
      };
      conditions?: Condition[];
    }
  | {
      type: 'choice';
      id: string;
      prompt?: string;
      options: ChoiceOption[];
    };

type ChoiceOption = {
  id: string;
  label: string;
  nodes: DialogueNode[];
  conditions?: Condition[];
};

type Transcript = {
  id: string;
  title: string;
  category: 'main-story' | 'event-story' | 'interrogation';
  nodes: DialogueNode[];
};
```

The renderer should process `DialogueNode[]` recursively. This supports choices nested inside other choice branches without requiring a separate implementation for each nesting level.

## 9. State Requirements

The transcript view should maintain:

```ts
type TranscriptContext = {
  protagonistGender: 'male' | 'female';
  selectedChoices: Record<string, string>;
};
```

The application should:

- Update the visible transcript when context changes.
- Reset or reconcile invalid choice selections when gender changes.
- Avoid mutating the source transcript data.
- Keep state scoped to the current transcript unless persistence is explicitly enabled.

## 10. URL Structure

The application should use deep-linkable routes similar to:

```text
/main-story/:chapterId/:stageId
/event-story/:eventId/:stageId
/interrogation/:characterId/:partId
```

Optional query parameters may include:

```text
?gender=female
```

Choice selections generally do not need to be encoded in the URL unless shareable branch states are a requirement.

## 11. Recommended Technical Approach

Angular is suitable for this application because it provides:

- Typed TypeScript models for transcript data.
- Angular Router for the multi-level navigation flow.
- Reusable components for chapters, stages, characters, and transcript blocks.
- Recursive components for nested choices.
- Services or a state store for gender and choice state.
- Lazy loading if the archive becomes large.

Suggested component structure:

```text
HomeComponent
MainStoryComponent
EventStoryComponent
InterrogationComponent
ChapterListComponent
EventListComponent
CharacterListComponent
StageListComponent
PartListComponent
TranscriptComponent
DialogueBlockComponent
ChoiceComponent
```

For a small static archive, transcript data can initially be stored in JSON files. If content will be edited frequently or supplied by multiple contributors, use a backend API or content management system later.

## 12. Non-Functional Requirements

- The application must work on desktop and mobile screen sizes.
- All navigation and choice controls must be keyboard accessible.
- Choice state must be communicated clearly to screen readers.
- Transcript text must remain readable for long sessions.
- Routes must be reloadable and shareable.
- Missing chapters, stages, events, characters, parts, or transcripts must show a useful not-found state.
- Invalid dialogue conditions must fail safely without breaking the transcript.
- Content should be validated before it is published.

## 13. Acceptance Criteria

- A normal user can reach every transcript through the documented navigation flows.
- A normal user can search transcripts by supported archive metadata and text.
- A normal user cannot access transcript creation or administration controls.
- An authenticated administrator can add and publish a valid new transcript.
- A transcript displays speaker, dialogue, and description content correctly.
- Selecting a choice displays its affected lines.
- Selecting a different option in the same choice replaces the affected lines correctly.
- Nested choices render and function correctly.
- Changing protagonist gender updates all gender-dependent content.
- Choice-dependent and gender-dependent conditions can be combined.
- The current transcript can be refreshed or opened directly by URL.
- The interface remains usable on mobile and desktop.
- The source transcript data remains unchanged when a user interacts with choices.

## 14. Future Enhancements

Potential future features include:

- Full-text search across transcripts.
- Filters by speaker, chapter, event, character, or stage.
- Bookmarking and reading progress.
- A transcript comparison mode for two choice branches.
- Shareable URLs that encode gender and choice selections.
- Import and validation tools for transcript contributors.
- Localization and multiple language versions.
