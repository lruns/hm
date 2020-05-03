/*******************************************************************************
 * Copyright 2011 See AUTHORS file.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 ******************************************************************************/

package ru.neyvan.hm;

import com.badlogic.gdx.scenes.scene2d.actions.TemporalAction;
import com.badlogic.gdx.utils.Align;

/** Moves an actor from its current position, adding delta */

public class PathAction extends TemporalAction {
    private float startX, startY;
    private float deltaX, deltaY;
    private int alignment = Align.bottomLeft;
    private boolean startNotDefined = true;

    protected void begin () {
        if(startNotDefined){
            startX = target.getX(alignment);
            startY = target.getY(alignment);
        }
    }

    protected void update (float percent) {
        float x, y;
        if (percent == 0) {
            x = startX;
            y = startY;
        } else if (percent == 1) {
            x = startX + deltaX;
            y = startY + deltaY;
        } else {
            x = startX + deltaX * percent;
            y = startY + deltaY * percent;
        }
        target.setPosition(x, y, alignment);
    }

    public void reset () {
        super.reset();
        alignment = Align.bottomLeft;
        startNotDefined = true;
    }

    public void setStartPosition (float x, float y) {
        startNotDefined = false;
        startX = x;
        startY = y;
    }

    public void deltaPosition (float deltaX, float deltaY) {
        this.deltaX = deltaX;
        this.deltaY = deltaY;
    }

    public void deltaPosition (float deltaX, float deltaY, int alignment) {
        this.deltaX = deltaX;
        this.deltaY = deltaY;
        this.alignment = alignment;
    }

    public float getDeltaX () {
        return deltaX;
    }

    public void setDeltaX (float deltaX) {
        this.deltaX = deltaX;
    }

    public float getY () {
        return deltaY;
    }

    public void setY (float deltaY) {
        this.deltaY = deltaY;
    }

    /** Gets the starting X value, set in {@link #begin()}. */
    public float getStartX () {
        return startX;
    }

    /** Gets the starting Y value, set in {@link #begin()}. */
    public float getStartY () {
        return startY;
    }

    public int getAlignment () {
        return alignment;
    }

    public void setAlignment (int alignment) {
        this.alignment = alignment;
    }
}
