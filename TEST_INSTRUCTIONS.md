# Testing the Transition Kit Plugin

## Setup
1. Open After Effects
2. Go to Window > Extensions > Transition Kit Dev
3. Open the Debug panel by clicking the 🐛 Debug button

## Test 1: Basic Exit Transition
1. Create a new composition (1920x1080, 30fps)
2. Create a solid layer
3. Select the solid layer
4. Click "Add Exit" button
5. **Expected**: 
   - A new controller layer "TK_Transition_1" should be created
   - The solid should fade out from 0-150ms
   - The solid should slide left 200px over 500ms

## Test 2: Basic Enter Transition
1. With the same comp and controller from Test 1
2. Create another solid layer
3. Move playhead to anywhere within the transition (0-500ms)
4. Select the new solid
5. Click "Add Enter" button
6. **Expected**: 
   - The new solid should be linked to the same transition
   - It should fade in from 150-400ms (after the exit fade)
   - It should slide with the controller

## Test 3: Multiple Transitions
1. Move playhead to 2 seconds
2. Select a layer
3. Click "Add Exit"
4. **Expected**: 
   - New transition created at 2s mark with T2 sliders
   - Layer fades and slides at the new position

## Test 4: Direction Changes
1. Click the right arrow button
2. Create a new transition
3. **Expected**: Layer slides right instead of left

## Test 5: Custom Timing
1. Change Fade Out to 200ms
2. Change Fade In to 300ms
3. Change Slide to 250px
4. Create a new transition
5. **Expected**: 
   - Fade out: 0-200ms
   - Fade in: 200-500ms
   - Slide distance: 250px (scaled to comp size)

## Known Features to Verify:
- ✅ Direction arrows work as radio buttons (only one selected)
- ✅ Both Add Exit and Add Enter check for existing controllers
- ✅ Dynamic slider numbering (T1, T2, T3...)
- ✅ Add Enter can be used before Add Exit
- ✅ Easy Ease applied to position keyframes
- ✅ Undo groups for all operations