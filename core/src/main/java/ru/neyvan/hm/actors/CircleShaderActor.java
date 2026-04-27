package ru.neyvan.hm.actors;

import com.badlogic.gdx.graphics.Color;
import com.badlogic.gdx.graphics.Texture;
import com.badlogic.gdx.graphics.g2d.Batch;
import com.badlogic.gdx.graphics.glutils.ShaderProgram;
import com.badlogic.gdx.scenes.scene2d.Actor;

import ru.neyvan.hm.HM;

/**
 * Created by AndyGo on 28.03.2018.
 */

public class CircleShaderActor extends Actor {

    private static final float MIN_OPEN_FOR_DRAW = 0.01f;
    private ShaderProgram circle;
    private Texture pixel;
    private float open;
    private Color defaultColor;


    public CircleShaderActor(Color defaultColor) {
        this.defaultColor = defaultColor;
        pixel = new Texture("shaders/pixel.jpg");
        circle = HM.game.shader.getCircle();
        setOpen(0.0f);
        setColor();

    }

    @Override
    public void draw(Batch batch, float parentAlpha) {
        if(open < MIN_OPEN_FOR_DRAW) return;
        batch.setShader(circle);
        batch.draw(pixel, 0, 0, getWidth(), getHeight());
        batch.setShader(null);
    }

    public void setOpen(float open) {
        this.open = open;
        circle.begin();
        circle.setUniformf("u_opening", open);
        circle.end();
    }

    public void setColor() {
        circle.begin();
        circle.setUniformf("u_color", defaultColor.r, defaultColor.g, defaultColor.b);
        circle.end();
    }

    public void setColor(Color color) {
        circle.begin();
        circle.setUniformf("u_color", color.r, color.g, color.b);
        circle.end();
    }
}
