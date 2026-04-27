//package ru.neyvan.hm.actors;
//
//import com.badlogic.gdx.Gdx;
//import com.badlogic.gdx.graphics.Color;
//import com.badlogic.gdx.graphics.g2d.Batch;
//import com.badlogic.gdx.graphics.g2d.NinePatch;
//import com.badlogic.gdx.graphics.g2d.TextureRegion;
//import com.badlogic.gdx.math.Interpolation;
//import com.badlogic.gdx.math.MathUtils;
//import com.badlogic.gdx.scenes.scene2d.Stage;
//import com.badlogic.gdx.scenes.scene2d.ui.ProgressBar;
//import com.badlogic.gdx.scenes.scene2d.ui.Skin;
//import com.badlogic.gdx.scenes.scene2d.ui.Widget;
//import com.badlogic.gdx.scenes.scene2d.utils.ChangeListener;
//import com.badlogic.gdx.scenes.scene2d.utils.Disableable;
//import com.badlogic.gdx.scenes.scene2d.utils.Drawable;
//import com.badlogic.gdx.utils.Pools;
//
///**
// * Created by AndyGo on 02.12.2017.
// */
//public class RadialProgressBar extends Widget implements Disableable {
//    private RadialProgressBar.RadialProgressBarStyle style;
//    private float min, max, stepSize;
//    private float value, animateFromValue;
//    float position;
//    private float animateDuration, animateTime;
//    private Interpolation animateInterpolation = Interpolation.linear;
//    boolean disabled;
//    private Interpolation visualInterpolation = Interpolation.linear;
//    private boolean round = true;
//
//    public RadialProgressBar (float min, float max, float stepSize, boolean vertical, Skin skin) {
//        this(min, max, stepSize, vertical, skin.get("default-" + (vertical ? "vertical" : "horizontal"), ProgressBar.ProgressBarStyle.class));
//    }
//
//    public RadialProgressBar (float min, float max, float stepSize, boolean vertical, Skin skin, String styleName) {
//        this(min, max, stepSize, vertical, skin.get(styleName, ProgressBar.ProgressBarStyle.class));
//    }
//
//    /** Creates a new progress bar. If horizontal, its width is determined by the prefWidth parameter, and its height is determined by the
//     * maximum of the height of either the progress bar {@link NinePatch} or progress bar handle {@link TextureRegion}. The min and
//     * max values determine the range the values of this progress bar can take on, the stepSize parameter specifies the distance
//     * between individual values.
//     * <p>
//     * E.g. min could be 4, max could be 10 and stepSize could be 0.2, giving you a total of 30 values, 4.0 4.2, 4.4 and so on.
//     * @param min the minimum value
//     * @param max the maximum value
//     * @param stepSize the step size between values
//     * @param style the {@link ProgressBar.ProgressBarStyle} */
//    public RadialProgressBar (float min, float max, float stepSize, RadialProgressBar.RadialProgressBarStyle style) {
//        if (min > max) throw new IllegalArgumentException("max must be > min. min,max: " + min + ", " + max);
//        if (stepSize <= 0) throw new IllegalArgumentException("stepSize must be > 0: " + stepSize);
//        setStyle(style);
//        this.min = min;
//        this.max = max;
//        this.stepSize = stepSize;
//        this.value = min;
//        setSize(getPrefWidth(), getPrefHeight());
//    }
//
//    public void setStyle (RadialProgressBar.RadialProgressBarStyle style) {
//        if (style == null) throw new IllegalArgumentException("style cannot be null.");
//        this.style = style;
//        invalidateHierarchy();
//    }
//
//    /** Returns the progress bar's style. Modifying the returned style may not have an effect until
//     * {@link #setStyle(RadialProgressBar.RadialProgressBarStyle)} is called. */
//    public RadialProgressBar.RadialProgressBarStyle getStyle () {
//        return style;
//    }
//
//    @Override
//    public void act (float delta) {
//        super.act(delta);
//        if (animateTime > 0) {
//            animateTime -= delta;
//            Stage stage = getStage();
//            if (stage != null && stage.getActionsRequestRendering()) Gdx.graphics.requestRendering();
//        }
//    }
//
//    @Override
//    public void draw (Batch batch, float parentAlpha) {
//        RadialProgressBar.RadialProgressBarStyle style = this.style;
//        boolean disabled = this.disabled;
//        final Drawable knob = getKnobDrawable();
//        final Drawable bg = (disabled && style.disabledBackground != null) ? style.disabledBackground : style.background;
//        final Drawable knobBefore = (disabled && style.disabledKnobBefore != null) ? style.disabledKnobBefore : style.knobBefore;
//        final Drawable knobAfter = (disabled && style.disabledKnobAfter != null) ? style.disabledKnobAfter : style.knobAfter;
//
//        Color color = getColor();
//        float x = getX();
//        float y = getY();
//        float width = getWidth();
//        float height = getHeight();
//        float knobHeight = knob == null ? 0 : knob.getMinHeight();
//        float knobWidth = knob == null ? 0 : knob.getMinWidth();
//        float percent = getVisualPercent();
//
//        batch.setColor(color.r, color.g, color.b, color.a * parentAlpha);
//
//        float positionHeight = height;
//        float bgTopHeight = 0;
//        if (bg != null) {
//            if (round)
//                bg.draw(batch, Math.round(x + (width - bg.getMinWidth()) * 0.5f), y, Math.round(bg.getMinWidth()), height);
//            else
//                bg.draw(batch, x + width - bg.getMinWidth() * 0.5f, y, bg.getMinWidth(), height);
//            bgTopHeight = bg.getTopHeight();
//            positionHeight -= bgTopHeight + bg.getBottomHeight();
//        }
//
//        float knobHeightHalf = 0;
//        if (min != max) {
//            if (knob == null) {
//                knobHeightHalf = knobBefore == null ? 0 : knobBefore.getMinHeight() * 0.5f;
//                position = (positionHeight - knobHeightHalf) * percent;
//                position = Math.min(positionHeight - knobHeightHalf, position);
//            } else {
//                knobHeightHalf = knobHeight * 0.5f;
//                position = (positionHeight - knobHeight) * percent;
//                position = Math.min(positionHeight - knobHeight, position) + bg.getBottomHeight();
//            }
//            position = Math.max(0, position);
//        }
//
//        if (knobBefore != null) {
//            float offset = 0;
//            if (bg != null) offset = bgTopHeight;
//            if (round)
//                knobBefore.draw(batch, Math.round(x + (width - knobBefore.getMinWidth()) * 0.5f), Math.round(y + offset), Math.round(knobBefore.getMinWidth()),
//                        Math.round(position + knobHeightHalf));
//                knobBefore.draw();
//            else
//                knobBefore.draw(batch, x + (width - knobBefore.getMinWidth()) * 0.5f, y + offset, knobBefore.getMinWidth(),
//                        position + knobHeightHalf);
//        }
//        if (knobAfter != null) {
//            if (round)
//                knobAfter.draw(batch, Math.round(x + (width - knobAfter.getMinWidth()) * 0.5f), Math.round(y + position + knobHeightHalf),
//                        Math.round(knobAfter.getMinWidth()), Math.round(height - position - knobHeightHalf));
//            else
//                knobAfter.draw(batch, x + (width - knobAfter.getMinWidth()) * 0.5f, y + position + knobHeightHalf,
//                        knobAfter.getMinWidth(), height - position - knobHeightHalf);
//        }
//        if (knob != null) {
//            if (round)
//                knob.draw(batch, Math.round(x + (width - knobWidth) * 0.5f), Math.round(y + position), Math.round(knobWidth), Math.round(knobHeight));
//            else
//                knob.draw(batch, x + (width - knobWidth) * 0.5f, y + position, knobWidth, knobHeight);
//        }
//    }
//
//    public float getValue () {
//        return value;
//    }
//
//    /** If {@link #setAnimateDuration(float) animating} the progress bar value, this returns the value current displayed. */
//    public float getVisualValue () {
//        if (animateTime > 0) return animateInterpolation.apply(animateFromValue, value, 1 - animateTime / animateDuration);
//        return value;
//    }
//
//    public float getPercent () {
//        return (value - min) / (max - min);
//    }
//
//    public float getVisualPercent () {
//        return visualInterpolation.apply((getVisualValue() - min) / (max - min));
//    }
//
//    protected Drawable getKnobDrawable () {
//        return (disabled && style.disabledKnob != null) ? style.disabledKnob : style.knob;
//    }
//
//    /** Returns progress bar visual position within the range. */
//    protected float getKnobPosition () {
//        return this.position;
//    }
//
//    /** Sets the progress bar position, rounded to the nearest step size and clamped to the minimum and maximum values.
//     * {@link #clamp(float)} can be overridden to allow values outside of the progress bar's min/max range.
//     * @return false if the value was not changed because the progress bar already had the value or it was canceled by a
//     *         listener. */
//    public boolean setValue (float value) {
//        value = clamp(Math.round(value / stepSize) * stepSize);
//        float oldValue = this.value;
//        if (value == oldValue) return false;
//        float oldVisualValue = getVisualValue();
//        this.value = value;
//        ChangeListener.ChangeEvent changeEvent = Pools.obtain(ChangeListener.ChangeEvent.class);
//        boolean cancelled = fire(changeEvent);
//        if (cancelled)
//            this.value = oldValue;
//        else if (animateDuration > 0) {
//            animateFromValue = oldVisualValue;
//            animateTime = animateDuration;
//        }
//        Pools.free(changeEvent);
//        return !cancelled;
//    }
//
//    /** Clamps the value to the progress bar's min/max range. This can be overridden to allow a range different from the progress
//     * bar knob's range. */
//    protected float clamp (float value) {
//        return MathUtils.clamp(value, min, max);
//    }
//
//    /** Sets the range of this progress bar. The progress bar's current value is clamped to the range. */
//    public void setRange (float min, float max) {
//        if (min > max) throw new IllegalArgumentException("min must be <= max");
//        this.min = min;
//        this.max = max;
//        if (value < min)
//            setValue(min);
//        else if (value > max) setValue(max);
//    }
//
//    public void setStepSize (float stepSize) {
//        if (stepSize <= 0) throw new IllegalArgumentException("steps must be > 0: " + stepSize);
//        this.stepSize = stepSize;
//    }
//
//    public float getPrefWidth () {
//        if (vertical) {
//            final Drawable knob = getKnobDrawable();
//            final Drawable bg = (disabled && style.disabledBackground != null) ? style.disabledBackground : style.background;
//            return Math.max(knob == null ? 0 : knob.getMinWidth(), bg.getMinWidth());
//        } else
//            return 140;
//    }
//
//    public float getPrefHeight () {
//        if (vertical)
//            return 140;
//        else {
//            final Drawable knob = getKnobDrawable();
//            final Drawable bg = (disabled && style.disabledBackground != null) ? style.disabledBackground : style.background;
//            return Math.max(knob == null ? 0 : knob.getMinHeight(), bg == null ? 0 : bg.getMinHeight());
//        }
//    }
//
//    public float getMinValue () {
//        return this.min;
//    }
//
//    public float getMaxValue () {
//        return this.max;
//    }
//
//    public float getStepSize () {
//        return this.stepSize;
//    }
//
//    /** If > 0, changes to the progress bar value via {@link #setValue(float)} will happen over this duration in seconds. */
//    public void setAnimateDuration (float duration) {
//        this.animateDuration = duration;
//    }
//
//    /** Sets the interpolation to use for {@link #setAnimateDuration(float)}. */
//    public void setAnimateInterpolation (Interpolation animateInterpolation) {
//        if (animateInterpolation == null) throw new IllegalArgumentException("animateInterpolation cannot be null.");
//        this.animateInterpolation = animateInterpolation;
//    }
//
//    /** Sets the interpolation to use for display. */
//    public void setVisualInterpolation (Interpolation interpolation) {
//        this.visualInterpolation = interpolation;
//    }
//
//    /** If true (the default), inner Drawable positions and sizes are rounded to integers.*/
//    public void setRound (boolean round) {
//        this.round = round;
//    }
//
//    public void setDisabled (boolean disabled) {
//        this.disabled = disabled;
//    }
//
//    public boolean isDisabled () {
//        return disabled;
//    }
//
//    /** The style for a progress bar, see {@link ProgressBar}.
//     * @author mzechner
//     * @author Nathan Sweet */
//    static public class RadialProgressBarStyle {
//        /** The progress bar background, stretched only in one direction. Optional. */
//        public Drawable background;
//        /** Optional. **/
//        public Drawable disabledBackground;
//        /** Optional, centered on the background. */
//        public Drawable knob, disabledKnob;
//        /** Optional. */
//        public Drawable knobBefore, knobAfter, disabledKnobBefore, disabledKnobAfter;
//
//        public RadialProgressBarStyle () {
//        }
//
//        public RadialProgressBarStyle (Drawable background, Drawable knob) {
//            this.background = background;
//            this.knob = knob;
//        }
//
//        public RadialProgressBarStyle (ProgressBar.ProgressBarStyle style) {
//            this.background = style.background;
//            this.disabledBackground = style.disabledBackground;
//            this.knob = style.knob;
//            this.disabledKnob = style.disabledKnob;
//            this.knobBefore = style.knobBefore;
//            this.knobAfter = style.knobAfter;
//            this.disabledKnobBefore = style.disabledKnobBefore;
//            this.disabledKnobAfter = style.disabledKnobAfter;
//        }
//    }
//}
